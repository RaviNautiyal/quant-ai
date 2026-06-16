from fastapi import APIRouter, Header, HTTPException
from app.database.db import alerts_collection
from app.utils.auth import decode_token
from app.services.price_cache import get_price_or_fetch
from pydantic import BaseModel
from datetime import datetime
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.routes.push import notify_user_sync   # ← sync version, no asyncio needed

router = APIRouter()

SENDER_EMAIL    = os.getenv("ALERT_EMAIL_SENDER")
SENDER_PASSWORD = os.getenv("ALERT_EMAIL_PASSWORD")


# ── Email helper ──────────────────────────────────────────────────────────────

def send_alert_email(to_email: str, ticker: str, condition: str, target: float, current: float):
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        print("[alerts] Email not configured — skipping notification")
        return

    direction = "risen above" if condition == "above" else "fallen below"
    subject   = f"QuantAI Alert: {ticker} has {direction} ₹{target:,.2f}"

    html = f"""
    <div style="font-family: 'Segoe UI', sans-serif; background: #111111; color: #f0f0ee; padding: 32px; border-radius: 12px; max-width: 480px; margin: auto;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 13px; color: #3dba6a; font-weight: 700; letter-spacing: 0.08em;">QUANTAI PRICE ALERT</span>
      </div>
      <h2 style="font-size: 28px; font-weight: 800; color: #f0f0ee; margin: 0 0 4px;">{ticker}</h2>
      <p style="font-size: 14px; color: #555552; margin: 0 0 24px;">Your alert has been triggered</p>
      <div style="background: #1a1a1a; border: 0.5px solid #2c2c2c; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
          <span style="font-size:12px; color:#555552; text-transform:uppercase; letter-spacing:0.06em;">Condition</span>
          <span style="font-size:13px; color:#f0f0ee; font-weight:600;">Price {direction} ₹{target:,.2f}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
          <span style="font-size:12px; color:#555552; text-transform:uppercase; letter-spacing:0.06em;">Target Price</span>
          <span style="font-size:13px; color:#f0f0ee; font-weight:600;">₹{target:,.2f}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="font-size:12px; color:#555552; text-transform:uppercase; letter-spacing:0.06em;">Current Price</span>
          <span style="font-size:16px; font-weight:800; color:{'#3dba6a' if condition == 'above' else '#e05555'};">₹{current:,.2f}</span>
        </div>
      </div>
      <p style="font-size:12px; color:#333; text-align:center; margin:0;">
        Triggered at {datetime.now().strftime("%d %b %Y, %I:%M %p IST")} · QuantAI
      </p>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"QuantAI Alerts <{SENDER_EMAIL}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        print(f"[alerts] Email sent to {to_email} for {ticker}")
    except Exception as e:
        print(f"[alerts] Email failed for {ticker}: {e}")


# ── Routes ────────────────────────────────────────────────────────────────────

class AlertSchema(BaseModel):
    ticker:       str
    target_price: float
    condition:    str   # "above" or "below"


@router.post("/add")
def add_alert(data: AlertSchema, authorization: str = Header(...)):
    email = get_user_from_token(authorization)

    if data.condition not in ("above", "below"):
        raise HTTPException(status_code=400, detail="condition must be 'above' or 'below'")

    current = get_price_or_fetch(data.ticker.upper())

    alerts_collection.insert_one({
        "email":               email,
        "ticker":              data.ticker.upper(),
        "target_price":        data.target_price,
        "condition":           data.condition,
        "triggered":           False,
        "created_at":          datetime.utcnow().isoformat(),
        "current_at_creation": round(current, 2) if current else None,
    })

    return {
        "message":       "Alert created successfully",
        "ticker":        data.ticker.upper(),
        "target":        data.target_price,
        "condition":     data.condition,
        "current_price": round(current, 2) if current else None,
    }


@router.get("/all")
def get_alerts(authorization: str = Header(...)):
    email  = get_user_from_token(authorization)
    alerts = list(alerts_collection.find({"email": email}, {"_id": 0}))

    for alert in alerts:
        try:
            price = get_price_or_fetch(alert["ticker"])
            alert["current_price"] = round(price, 2) if price else None
        except Exception:
            alert["current_price"] = None

    return alerts


@router.delete("/remove/{ticker}")
def remove_alert(ticker: str, authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    alerts_collection.delete_one({"email": email, "ticker": ticker.upper()})
    return {"message": "Alert removed"}


@router.get("/check")
def check_alerts(authorization: str = Header(...)):
    email  = get_user_from_token(authorization)
    alerts = list(alerts_collection.find({"email": email, "triggered": False}))
    triggered = []

    for alert in alerts:
        try:
            current_price = get_price_or_fetch(alert["ticker"])
            if not current_price or current_price <= 0:
                continue

            is_triggered = (
                (alert["condition"] == "above" and current_price >= alert["target_price"]) or
                (alert["condition"] == "below" and current_price <= alert["target_price"])
            )

            if is_triggered:
                # 1 — Mark triggered
                alerts_collection.update_one(
                    {"email": email, "ticker": alert["ticker"], "condition": alert["condition"]},
                    {"$set": {
                        "triggered":    True,
                        "triggered_at": round(current_price, 2),
                        "triggered_ts": datetime.utcnow().isoformat(),
                    }}
                )

                # 2 — Email
                send_alert_email(
                    to_email  = email,
                    ticker    = alert["ticker"],
                    condition = alert["condition"],
                    target    = alert["target_price"],
                    current   = current_price,
                )

                # 3 — Push notification (sync, no asyncio wrapper needed)
                direction = "▲" if alert["condition"] == "above" else "▼"
                notify_user_sync(
                    email = email,
                    title = f"{alert['ticker']} alert triggered",
                    body  = f"{direction} {alert['ticker']} hit ₹{current_price:,.2f} · target ₹{alert['target_price']:,.2f}",
                    url   = "/alerts",
                )

                triggered.append({
                    "ticker":        alert["ticker"],
                    "condition":     alert["condition"],
                    "target_price":  alert["target_price"],
                    "current_price": round(current_price, 2),
                })

        except Exception as e:
            print(f"[alerts] check failed for {alert['ticker']}: {e}")

    return {
        "triggered_alerts": triggered,
        "total_checked":    len(alerts),
        "checked_at":       datetime.utcnow().isoformat(),
    }


# ── Utility ───────────────────────────────────────────────────────────────────

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email