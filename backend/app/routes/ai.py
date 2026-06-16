"""
app/routes/ai.py

AI chat route — multi-turn conversation with portfolio context.
Free plan: 5 queries/day. Pro: unlimited.
"""

from fastapi import APIRouter, Header, HTTPException
from app.services.ai_service import get_ai_response
from app.utils.auth import decode_token
from app.database.db import transactions_collection, users_collection
from app.services.price_cache import get_price_or_fetch
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import google.generativeai as genai
import os

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    history: Optional[list] = []   # [{"role": "user"|"model", "text": "..."}]


def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email


def build_portfolio_context(email: str) -> str:
    """
    Builds a rich portfolio context string from live transaction data.
    Includes holdings, avg cost, current price, P&L.
    """
    try:
        from app.routes.portfolio import compute_holdings
        txns = list(transactions_collection.find({"email": email}, {"_id": 0}))
        if not txns:
            return "User has no holdings in portfolio."

        holdings, realized_pnl = compute_holdings(txns)
        if not holdings:
            return "User has no open positions."

        lines = ["USER PORTFOLIO (Live Data):"]
        total_invested = 0
        total_value    = 0

        for sym, data in holdings.items():
            if data["quantity"] <= 0:
                continue
            avg_cost = data["total_cost"] / data["quantity"]
            live_price = get_price_or_fetch(sym) or avg_cost
            current_value  = data["quantity"] * live_price
            invested       = data["quantity"] * avg_cost
            pnl            = current_value - invested
            pnl_pct        = (pnl / invested * 100) if invested else 0
            total_invested += invested
            total_value    += current_value

            lines.append(
                f"- {sym}: {round(data['quantity'], 2)} shares | "
                f"Avg ₹{round(avg_cost,2)} | Live ₹{round(live_price,2)} | "
                f"P&L: {'+'if pnl>=0 else ''}₹{round(pnl,2)} ({round(pnl_pct,1)}%)"
            )

        total_pnl = total_value - total_invested
        lines.append(f"\nTotal Invested: ₹{round(total_invested,2)}")
        lines.append(f"Total Value:    ₹{round(total_value,2)}")
        lines.append(f"Overall P&L:    {'+'if total_pnl>=0 else ''}₹{round(total_pnl,2)} ({round(total_pnl/total_invested*100,1) if total_invested else 0}%)")
        lines.append(f"Realized P&L:   ₹{round(realized_pnl,2)}")

        return "\n".join(lines)

    except Exception as e:
        print(f"[ai] portfolio context error: {e}")
        return "Portfolio data unavailable."


@router.get("/models")
def list_models():
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    models = [m.name for m in genai.list_models()]
    return {"models": models}


@router.post("/chat")
def chat(msg: ChatMessage, authorization: str = Header(...)):
    email = get_user_from_token(authorization)

    # ── Rate limiting for free users ──────────────────────────────────────────
    user = users_collection.find_one({"email": email})
    plan = (user or {}).get("plan", "free")

    if plan == "free":
        today          = datetime.utcnow().strftime("%Y-%m-%d")
        queries_date   = (user or {}).get("ai_queries_date", "")
        queries_today  = (user or {}).get("ai_queries_today", 0)

        if queries_date != today:
            users_collection.update_one(
                {"email": email},
                {"$set": {"ai_queries_today": 0, "ai_queries_date": today}},
                upsert=True
            )
            queries_today = 0

        if queries_today >= 5:
            return {
                "response": (
                    "⚠️ You've used all 5 free AI queries for today.\n\n"
                    "Upgrade to **Pro** for unlimited AI access, advanced analysis, and real-time alerts."
                ),
                "limit_reached": True,
                "queries_used":  5,
                "queries_limit": 5,
            }

        users_collection.update_one(
            {"email": email},
            {"$inc": {"ai_queries_today": 1}, "$set": {"ai_queries_date": today}},
            upsert=True
        )
        queries_used  = queries_today + 1
        queries_limit = 5
    else:
        queries_used  = None
        queries_limit = None

    # ── Build context + call AI ───────────────────────────────────────────────
    portfolio_context = build_portfolio_context(email)
    response = get_ai_response(
        message=msg.message,
        portfolio_context=portfolio_context,
        conversation_history=msg.history or [],
    )

    return {
        "response":      response,
        "limit_reached": False,
        "queries_used":  queries_used,
        "queries_limit": queries_limit,
    }