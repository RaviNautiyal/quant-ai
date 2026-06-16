

import threading, time, logging
from datetime import datetime
from app.database.db import alerts_collection
from app.services.price_cache import get_price_or_fetch

logger = logging.getLogger("alert_scheduler")
_running = False


def _check_all_alerts():
    from app.routes.alerts import send_alert_email
    # from app.routes.push import get_user_subscriptions
    from app.services.push_service import send_alert_push

    try:
        alerts = list(alerts_collection.find({"triggered": False}))
        if not alerts:
            return

        logger.debug(f"[alerts] checking {len(alerts)} active alerts")

        for alert in alerts:
            try:
                current_price = get_price_or_fetch(alert["ticker"])
                if not current_price or current_price <= 0:
                    continue

                is_triggered = (
                    (alert["condition"] == "above" and current_price >= alert["target_price"]) or
                    (alert["condition"] == "below" and current_price <= alert["target_price"])
                )

                if not is_triggered:
                    continue

                # Mark triggered
                alerts_collection.update_one(
                    {"_id": alert["_id"]},
                    {"$set": {
                        "triggered":    True,
                        "triggered_at": round(current_price, 2),
                        "triggered_ts": datetime.utcnow().isoformat(),
                    }}
                )

                email = alert["email"]
                logger.info(f"[alerts] triggered: {alert['ticker']} @ ₹{current_price} for {email}")

                # 1. Email notification
                try:
                    send_alert_email(
                        to_email  = email,
                        ticker    = alert["ticker"],
                        condition = alert["condition"],
                        target    = alert["target_price"],
                        current   = current_price,
                    )
                except Exception as e:
                    logger.error(f"[alerts] email failed: {e}")

                # 2. Push notification (if subscribed)
                try:
                    subs = get_user_subscriptions(email)
                    for sub in subs:
                        send_alert_push(
                            subscription = {"endpoint": sub["endpoint"], "keys": sub["keys"]},
                            ticker       = alert["ticker"],
                            condition    = alert["condition"],
                            target       = alert["target_price"],
                            current      = current_price,
                        )
                except Exception as e:
                    logger.debug(f"[alerts] push failed: {e}")

            except Exception as e:
                logger.debug(f"[alerts] check error for {alert.get('ticker')}: {e}")

    except Exception as e:
        logger.error(f"[alerts] scheduler error: {e}")


def _run_loop():
    global _running
    logger.info("[alerts] scheduler started — checking every 30s")
    while _running:
        _check_all_alerts()
        time.sleep(30)


def start_scheduler():
    global _running
    if _running:
        return
    _running = True
    threading.Thread(target=_run_loop, daemon=True, name="alert-scheduler").start()


def stop_scheduler():
    global _running
    _running = False
