from fastapi import APIRouter, Header, HTTPException
from app.database.db import users_collection
from app.utils.auth import decode_token
from pydantic import BaseModel
import razorpay
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

router = APIRouter()

client = razorpay.Client(
    auth=(
        os.getenv("RAZORPAY_KEY_ID"),
        os.getenv("RAZORPAY_KEY_SECRET")
    )
)

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@router.post("/create-order")
def create_order(authorization: str = Header(...)):
    get_user_from_token(authorization)

    try:
        order = client.order.create({
            "amount": 49900,  # ₹499 in paise
            "currency": "INR",
            "payment_capture": 1
        })
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": os.getenv("RAZORPAY_KEY_ID")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify")
def verify_payment(
    data: PaymentVerify,
    authorization: str = Header(...)
):
    email = get_user_from_token(authorization)

    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "razorpay_signature": data.razorpay_signature
        })

        # Upgrade user to pro
        users_collection.update_one(
            {"email": email},
            {"$set": {
                "plan": "pro",
                "subscribed_at": datetime.utcnow().isoformat()
            }}
        )

        return {"message": "Payment verified. You are now Pro!"}

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Payment verification failed"
        )

@router.get("/plan")
def get_plan(authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    user = users_collection.find_one({"email": email}, {"_id": 0})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "email": email,
        "plan": user.get("plan", "free"),
        "subscribed_at": user.get("subscribed_at", None)
    }

@router.post("/cancel")
def cancel_subscription(authorization: str = Header(...)):
    email = get_user_from_token(authorization)

    users_collection.update_one(
        {"email": email},
        {"$set": {
            "plan": "free",
            "subscribed_at": None
        }}
    )

    return {"message": "Subscription cancelled"}