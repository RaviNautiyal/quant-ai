from fastapi import APIRouter, Header, HTTPException
from app.database.db import watchlist_collection
from app.utils.auth import decode_token
from app.services.instruments import get_live_price
from app.services.price_cache import get_price_or_fetch
import yfinance as yf

router = APIRouter()

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email

@router.post("/add")
def add_to_watchlist(data: dict, authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    existing = watchlist_collection.find_one({"email": email, "ticker": data["ticker"].upper()})
    if existing:
        return {"message": "Already in watchlist"}
    watchlist_collection.insert_one({"email": email, "ticker": data["ticker"].upper()})
    return {"message": "Added to watchlist"}

@router.delete("/remove/{ticker}")
def remove_from_watchlist(ticker: str, authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    watchlist_collection.delete_one({"email": email, "ticker": ticker.upper()})
    return {"message": "Removed from watchlist"}

@router.get("/all")
def get_watchlist(authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    items = list(watchlist_collection.find({"email": email}, {"_id": 0}))

    enriched = []

    for item in items:
        sym = item["ticker"].upper()

        # ── Live price: Angel One first, price_cache fallback ─────────────────
        live_price = 0.0
        try:
            cached = get_price_or_fetch(sym)
            if cached:
                live_price = cached
            else:
                live_price = get_live_price(sym)
        except Exception:
            live_price = 0.0

        # ── Metadata + prev_close via yfinance ────────────────────────────────
        name       = sym
        change_1d  = 0.0
        volume     = 0
        market_cap = 0

        try:
            yf_sym     = f"{sym}.NS"
            ticker_obj = yf.Ticker(yf_sym)
            info       = ticker_obj.info or {}

            # Fallback to plain symbol if .NS has no data
            if not info.get("shortName") and not info.get("longName"):
                ticker_obj = yf.Ticker(sym)
                info       = ticker_obj.info or {}

            name       = info.get("longName") or info.get("shortName") or sym
            volume     = info.get("regularMarketVolume") or info.get("volume") or 0
            market_cap = info.get("marketCap") or 0

            # ── BUG FIX: use Angel One live_price vs yfinance prev_close ──────
            # Old code used prices[-1] (yfinance today close) as the numerator,
            # making change_1d always slightly stale.
            # Now we use the real-time Angel One price vs yesterday's yfinance close.
            hist   = ticker_obj.history(period="5d")
            prices = hist["Close"].tolist()
            if len(prices) >= 2 and live_price > 0:
                prev_close = prices[-2]          # yesterday's confirmed close
                change_1d  = round(((live_price - prev_close) / prev_close) * 100, 2)
            elif len(prices) >= 2:
                # No live price — fall back to yfinance close vs prev close
                change_1d  = round(((prices[-1] - prices[-2]) / prices[-2]) * 100, 2)

        except Exception as e:
            print(f"[watchlist] yfinance failed for {sym}: {e}")

        enriched.append({
            "ticker":     sym,
            "name":       name,
            "price":      round(live_price, 2),
            "change_1d":  change_1d,
            "volume":     volume,
            "market_cap": market_cap,
        })

    return enriched