

import os, json, logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("push_service")

VAPID_PUBLIC_KEY  = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT     = os.getenv("VAPID_SUBJECT", "mailto:admin@quantai.app")


def send_push(subscription: dict, title: str, body: str, url: str = "/alerts") -> bool:
    """
    Send a Web Push notification to a single subscription.
    subscription: { endpoint, keys: { p256dh, auth } }
    Returns True on success.
    """
    if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        logger.warning("[push] VAPID keys not configured — skipping push")
        return False

    try:
        from pywebpush import webpush, WebPushException

        payload = json.dumps({
            "title": title,
            "body":  body,
            "url":   url,
            "tag":   "quantai-alert",
            "icon":  "/icon-192.png",
        })

        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        logger.info(f"[push] sent: {title}")
        return True

    except ImportError:
        logger.warning("[push] pywebpush not installed. Run: pip install pywebpush")
        return False
    except Exception as e:
        logger.error(f"[push] failed: {e}")
        return False


def send_alert_push(subscription: dict, ticker: str, condition: str, target: float, current: float) -> bool:
    direction = "risen above" if condition == "above" else "fallen below"
    title     = f"QuantAI: {ticker} Alert Triggered"
    body      = f"{ticker} has {direction} ₹{target:,.2f} · Now at ₹{current:,.2f}"
    return send_push(subscription, title, body, url="/alerts")
