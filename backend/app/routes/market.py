from fastapi import APIRouter, Header, HTTPException
from app.utils.auth import decode_token
from app.services.angel_one import ltp_data
from app.services.price_cache import get_price_or_fetch, set_price
from app.services.instruments import get_symbol_token
import yfinance as yf

router = APIRouter()

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email

INDICES = [
    {"ticker": "^GSPC",  "name": "S&P 500"},
    {"ticker": "^IXIC",  "name": "NASDAQ"},
    {"ticker": "^DJI",   "name": "Dow Jones"},
    {"ticker": "^NSEI",  "name": "Nifty 50"},
    {"ticker": "^BSESN", "name": "Sensex"},
    {"ticker": "^FTSE",  "name": "FTSE 100"},
]

# ── BUG FIX: removed hardcoded Angel One tokens — they go stale.
# Now uses get_symbol_token() to resolve tokens dynamically at runtime,
# same as the screener does. Only the ticker name is stored here.
MOVER_TICKERS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "SBIN", "BAJFINANCE", "WIPRO", "AXISBANK", "KOTAKBANK",
]

# Sector universe — matches SECTOR_MAP in screener.py
SECTOR_UNIVERSE = {
    "Banking":        ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK"],
    "IT":             ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM"],
    "Energy":         ["RELIANCE", "ONGC", "BPCL"],
    "Pharma":         ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB"],
    "Auto":           ["MARUTI", "TATAMOTORS", "HEROMOTOCO", "EICHERMOT"],
    "FMCG":           ["HINDUNILVR", "ITC", "NESTLEIND", "TATACONSUM"],
    "Metals":         ["TATASTEEL", "JSWSTEEL", "COALINDIA"],
    "Infrastructure": ["LT", "ADANIPORTS", "NTPC"],
}


@router.get("/indices")
def get_indices(authorization: str = Header(...)):
    get_user_from_token(authorization)
    results = []
    for index in INDICES:
        try:
            hist = yf.Ticker(index["ticker"]).history(period="2d")
            if hist.empty or len(hist) < 2:
                continue
            prices  = hist["Close"].tolist()
            current = round(prices[-1], 2)
            prev    = round(prices[-2], 2)
            change  = round(((current - prev) / prev) * 100, 2)
            results.append({
                "ticker": index["ticker"],
                "name":   index["name"],
                "price":  current,
                "change": change,
            })
        except Exception:
            continue
    return results


@router.get("/movers")
def get_movers(authorization: str = Header(...)):
    get_user_from_token(authorization)
    stocks = []

    for ticker in MOVER_TICKERS:
        try:
            # ── BUG FIX: resolve token dynamically instead of using hardcoded values ──
            token, exchange, trading_symbol = get_symbol_token(ticker)
            if not token:
                print(f"[market] no token found for {ticker}, skipping")
                continue

            # Price: cache first, Angel One fallback
            cached = get_price_or_fetch(ticker)
            if cached:
                ltp = cached
            else:
                resp = ltp_data(exchange, trading_symbol, token)
                if not resp.get("status") or not resp.get("data"):
                    continue
                ltp = float(resp["data"]["ltp"])
                set_price(ticker, ltp)

            # Prev close from yfinance
            hist = yf.Ticker(f"{ticker}.NS").history(period="2d")
            if hist.empty or len(hist) < 2:
                continue
            prev_close = round(hist["Close"].tolist()[-2], 2)
            change     = round(((ltp - prev_close) / prev_close) * 100, 2)

            # Stock name from yfinance info
            info = yf.Ticker(f"{ticker}.NS").info or {}
            name = info.get("longName") or info.get("shortName") or ticker

            stocks.append({
                "ticker": ticker,
                "name":   name,
                "price":  round(ltp, 2),
                "change": change,
            })

        except Exception as e:
            print(f"[market] movers error for {ticker}: {e}")
            continue

    stocks.sort(key=lambda x: x["change"], reverse=True)
    return {
        "gainers": stocks[:5],
        "losers":  sorted(stocks, key=lambda x: x["change"])[:5],
    }


@router.get("/sectors")
def get_sector_performance(authorization: str = Header(...)):
    """
    BUG FIX: dedicated sector endpoint so dashboard heatmap uses all
    sector stocks instead of deriving averages from only 10 mover stocks.

    Uses price_cache for live prices (populated by WebSocket / portfolio routes)
    with yfinance prev_close fallback — no Angel One calls needed here.
    """
    get_user_from_token(authorization)
    results = []

    for sector_name, tickers in SECTOR_UNIVERSE.items():
        changes = []
        for ticker in tickers:
            try:
                # Use cached live price if available
                live = get_price_or_fetch(ticker)
                hist = yf.Ticker(f"{ticker}.NS").history(period="2d")
                if hist.empty or len(hist) < 2:
                    continue
                prices = hist["Close"].tolist()
                prev_close = prices[-2]

                # Use live price if cached, else use yfinance latest close
                current = live if live else prices[-1]
                change  = round(((current - prev_close) / prev_close) * 100, 2)
                changes.append(change)
            except Exception:
                continue

        if changes:
            avg_change = round(sum(changes) / len(changes), 2)
            results.append({
                "name":        sector_name,
                "change":      avg_change,
                "stocks_used": len(changes),
            })

    results.sort(key=lambda x: x["change"], reverse=True)
    return results


@router.get("/summary")
def get_market_summary(authorization: str = Header(...)):
    get_user_from_token(authorization)
    try:
        def safe_last(ticker: str):
            try:
                hist   = yf.Ticker(ticker).history(period="2d")
                prices = hist["Close"].tolist()
                return round(prices[-1], 2) if prices else None
            except Exception:
                return None

        vix_value = safe_last("^VIX")
        if vix_value is None:
            raise Exception("VIX unavailable")

        if vix_value < 15:   sentiment, s_color = "Extreme Greed", "green"
        elif vix_value < 20: sentiment, s_color = "Greed",         "green"
        elif vix_value < 25: sentiment, s_color = "Neutral",       "yellow"
        elif vix_value < 30: sentiment, s_color = "Fear",          "red"
        else:                sentiment, s_color = "Extreme Fear",  "red"

        return {
            "vix":             vix_value,
            "sentiment":       sentiment,
            "sentiment_color": s_color,
            "gold":            safe_last("GC=F"),
            "oil":             safe_last("CL=F"),
            "usdinr":          safe_last("USDINR=X"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))