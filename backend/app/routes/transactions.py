from fastapi import APIRouter, HTTPException, Header
from app.database.db import transactions_collection
from app.utils.auth import decode_token
from app.services.price_cache import get_price_or_fetch
from app.services.instruments import get_live_price
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

router = APIRouter()

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return email

def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc

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

class Transaction(BaseModel):
    symbol: str
    type: str
    quantity: float
    date: str

@router.get("/live-price/{symbol}")
def get_price_preview(symbol: str, authorization: str = Header(...)):
    get_user_from_token(authorization)
    # Always fetch fresh for the add-transaction modal preview
    price = get_live_price(symbol.upper())
    return {
        "symbol": symbol.upper(),
        "live_price": price,
        "currency": "INR",
        "source": "Angel One"
    }

@router.get("/")
def get_transactions(authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    txns_raw = list(transactions_collection.find({"email": email}))
    print(f"[transactions] {email} → {len(txns_raw)} found")
    txns = [serialize(t) for t in txns_raw]

    if not txns:
        return {
            "transactions": [],
            "open_positions": [],
            "summary": {
                "total_invested": 0, "current_value": 0,
                "realized_pnl": 0, "unrealized_pnl": 0, "total_pnl": 0
            }
        }

    holdings, realized_pnl = compute_holdings(txns)
    open_positions = []
    total_current_value = 0.0

    for sym, data in holdings.items():
        if data["quantity"] <= 0:
            continue

        avg_cost = data["total_cost"] / data["quantity"]

        # ── Read from cache — no direct Angel One call on page load ──────────
        live_price = get_price_or_fetch(sym)
        if not live_price or live_price <= 0:
            print(f"[transactions] no price for {sym}, using avg cost")
            live_price = avg_cost

        current_value  = data["quantity"] * live_price
        invested       = data["quantity"] * avg_cost
        unrealized_pnl = current_value - invested
        total_current_value += current_value

        open_positions.append({
            "symbol":         sym,
            "quantity":       round(data["quantity"], 4),
            "avg_cost":       round(avg_cost, 2),
            "live_price":     round(live_price, 2),
            "current_value":  round(current_value, 2),
            "invested":       round(invested, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "percent_change": round((unrealized_pnl / invested * 100), 2) if invested else 0,
        })

    total_invested   = sum(float(t["quantity"]) * float(t["price"]) for t in txns if t["type"] == "buy")
    unrealized_total = total_current_value - sum(p["invested"] for p in open_positions)

    return {
        "transactions": txns,
        "open_positions": open_positions,
        "summary": {
            "total_invested":  round(total_invested, 2),
            "current_value":   round(total_current_value, 2),
            "realized_pnl":    round(realized_pnl, 2),
            "unrealized_pnl":  round(unrealized_total, 2),
            "total_pnl":       round(realized_pnl + unrealized_total, 2),
        }
    }

@router.post("/add")
def add_transaction(t: Transaction, authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    try:
        live_price = get_live_price(t.symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch price: {e}")

    print(f"[transactions] {t.symbol} @ ₹{live_price}")
    doc = {
        "email":      email,
        "symbol":     t.symbol.upper(),
        "type":       t.type.lower(),
        "quantity":   float(t.quantity),
        "price":      float(live_price),
        "date":       t.date,
        "created_at": datetime.utcnow().isoformat()
    }
    result = transactions_collection.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return {**doc, "message": f"Transaction recorded at live price ₹{live_price}"}

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: str, authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    try:
        obj_id = ObjectId(transaction_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transaction ID format")
    result = transactions_collection.delete_one({"_id": obj_id, "email": email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted successfully"}