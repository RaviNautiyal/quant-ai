from fastapi import APIRouter, HTTPException, Header
from app.database.db import transactions_collection
from app.utils.auth import decode_token
from app.services.price_cache import get_price_or_fetch
from datetime import datetime

router = APIRouter()

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return email

def compute_holdings(txns: list):
    holdings = {}
    realized_pnl = 0.0
    for t in sorted(txns, key=lambda x: x["date"]):
        sym = t["symbol"]
        qty = float(t["quantity"])
        price = float(t["price"])
        if sym not in holdings:
            holdings[sym] = {"quantity": 0.0, "total_cost": 0.0}
        if t["type"] == "buy":
            holdings[sym]["quantity"] += qty
            holdings[sym]["total_cost"] += qty * price
        elif t["type"] == "sell" and holdings[sym]["quantity"] > 0:
            avg_cost = holdings[sym]["total_cost"] / holdings[sym]["quantity"]
            realized_pnl += (price - avg_cost) * qty
            holdings[sym]["quantity"] -= qty
            holdings[sym]["total_cost"] -= avg_cost * qty
            if holdings[sym]["quantity"] <= 0:
                holdings[sym] = {"quantity": 0.0, "total_cost": 0.0}
    return holdings, realized_pnl

@router.get("/all")
def get_portfolio(authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    txns = list(transactions_collection.find({"email": email}, {"_id": 0}))
    if not txns:
        return []

    holdings, _ = compute_holdings(txns)
    enriched = []

    for sym, data in holdings.items():
        if data["quantity"] <= 0:
            continue

        avg_cost = data["total_cost"] / data["quantity"]

        # ── Read from cache first — avoids hitting Angel One on every load ──
        live_price = get_price_or_fetch(sym)
        if not live_price or live_price <= 0:
            live_price = avg_cost
            price_source = "cost_basis_fallback"
        else:
            price_source = "cache" if True else "angel_one"
            print(f"[portfolio] {sym} → ₹{live_price} ({price_source})")

        current_value  = data["quantity"] * live_price
        invested       = data["quantity"] * avg_cost
        profit_loss    = current_value - invested
        percent_change = (profit_loss / invested * 100) if invested else 0

        enriched.append({
            "ticker":            sym,
            "shares":            round(data["quantity"], 4),
            "avg_cost_usd":      round(avg_cost, 2),
            "avg_cost_inr":      round(avg_cost, 2),
            "invested":          round(invested, 2),
            "current_price_inr": round(live_price, 2),
            "current_price_usd": round(live_price, 2),
            "current_value":     round(current_value, 2),
            "profit_loss":       round(profit_loss, 2),
            "percent_change":    round(percent_change, 2),
            "price_source":      price_source,
        })

    return enriched

@router.post("/add")
def add_stock(data: dict, authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    doc = {
        "email":      email,
        "symbol":     data.get("ticker", "").upper(),
        "type":       "buy",
        "quantity":   float(data.get("quantity", 1)),
        "price":      float(data.get("price", 0)),
        "date":       data.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "created_at": datetime.utcnow().isoformat()
    }
    transactions_collection.insert_one(doc)
    return {"message": "Stock added and logged as transaction"}

@router.delete("/remove/{ticker}")
def remove_stock(ticker: str, authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    transactions_collection.delete_many({"email": email, "symbol": ticker.upper()})
    return {"message": f"All transactions for {ticker} removed"}

@router.delete("/clear")
def clear_portfolio(authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    transactions_collection.delete_many({"email": email})
    return {"message": "All transactions cleared"}