"""
app/routes/push.py — fixed to match your db.py structure
Uses named collection exports, not db.push_subscriptions

Add to app/main.py:
    from app.routes import push
    app.include_router(push.router, prefix="/push", tags=["push"])

Add to app/database/db.py:
    push_subscriptions_collection = db_instance["push_subscriptions"]

.env:
    VAPID_PRIVATE_KEY=...
    VAPID_SUBJECT=mailto:you@yourdomain.com

pip install pywebpush
"""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from app.database.db import push_subscriptions_collection
from app.utils.auth import decode_token
import os, json
from pywebpush import webpush, WebPushException

router = APIRouter()

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT     = os.environ.get("VAPID_SUBJECT", "mailto:admin@quantai.in")

# ── Models ────────────────────────────────────────────────────────────────────

class PushKeys(BaseModel):
    p256dh: str
    auth:   str

class SubscribeBody(BaseModel):
    endpoint: str
    keys:     PushKeys

class UnsubscribeBody(BaseModel):
    endpoint: str

# ── Auth ──────────────────────────────────────────────────────────────────────

def get_email_from_token(authorization: str) -> str:
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email

# ── Internal sender ───────────────────────────────────────────────────────────

def _send_one(sub_doc: dict, title: str, body: str, url: str) -> bool:
    """Synchronous push sender — matches your sync route pattern."""
    if not VAPID_PRIVATE_KEY:
        print("[push] VAPID_PRIVATE_KEY not set — skipping")
        return False

    sub_info = {
        "endpoint": sub_doc["endpoint"],
        "keys": {"p256dh": sub_doc["p256dh"], "auth": sub_doc["auth"]},
    }
    payload = json.dumps({"title": title, "body": body, "url": url,
                          "icon": "/icons/icon-192.png", "badge": "/icons/badge-72.png"})
    try:
        webpush(
            subscription_info = sub_info,
            data              = payload,
            vapid_private_key = VAPID_PRIVATE_KEY,
            vapid_claims      = {"sub": VAPID_SUBJECT},
        )
        return True
    except WebPushException as e:
        if e.response and e.response.status_code == 410:
            # Subscription expired — remove it
            push_subscriptions_collection.delete_one({"endpoint": sub_doc["endpoint"]})
            print(f"[push] Removed expired subscription")
        else:
            print(f"[push] WebPushException: {e}")
        return False
    except Exception as e:
        print(f"[push] Error: {e}")
        return False

# ── notify_user — called from alerts.py fire_push() ──────────────────────────

def notify_user_sync(email: str, title: str, body: str, url: str = "/alerts"):
    """
    Synchronous version. Called from alerts.py which uses sync def routes.
    Looks up subscriptions by email (matches your alerts.py pattern).
    """
    subs = list(push_subscriptions_collection.find({"email": email}))
    if not subs:
        print(f"[push] No subscriptions for {email}")
        return
    for sub in subs:
        _send_one(sub, title, body, url)

# Keep async version for any async callers
async def notify_user(email: str, title: str, body: str, url: str = "/alerts"):
    notify_user_sync(email, title, body, url)

# ── /push/subscribe ───────────────────────────────────────────────────────────

@router.post("/subscribe")
def subscribe(body: SubscribeBody, authorization: str = Header(...)):
    email = get_email_from_token(authorization)
    push_subscriptions_collection.update_one(
        {"email": email, "endpoint": body.endpoint},
        {"$set": {"email": email, "endpoint": body.endpoint,
                  "p256dh": body.keys.p256dh, "auth": body.keys.auth}},
        upsert=True,
    )
    return {"status": "subscribed"}

# ── /push/unsubscribe ─────────────────────────────────────────────────────────

@router.post("/unsubscribe")
def unsubscribe(body: UnsubscribeBody, authorization: str = Header(...)):
    email = get_email_from_token(authorization)
    push_subscriptions_collection.delete_one({"email": email, "endpoint": body.endpoint})
    return {"status": "unsubscribed"}

# ── /push/test ────────────────────────────────────────────────────────────────

@router.post("/test")
def send_test(authorization: str = Header(...)):
    email = get_email_from_token(authorization)
    subs  = list(push_subscriptions_collection.find({"email": email}))
    if not subs:
        raise HTTPException(status_code=404, detail="No subscriptions found. Enable notifications first.")
    sent = sum(1 for sub in subs if _send_one(sub, "QuantAI Test", "Push notifications working ✓", "/alerts"))
    return {"sent": sent, "total": len(subs)}