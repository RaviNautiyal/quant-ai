from fastapi import APIRouter, Header, HTTPException
from app.utils.auth import decode_token
from app.services.algorithms import calculate_volatility, simple_moving_average
from app.services.instruments import get_symbol_token, KNOWN_TOKENS
from app.services.angel_one import ltp_data, _throttle, get_session
from app.services.ai_service import get_ai_response
from app.services.price_cache import get_price_or_fetch, set_price
from datetime import datetime, timedelta
import yfinance as yf

router = APIRouter()

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email

# ── NSE stock universe (Nifty 50 + midcap picks) ─────────────────────────────
NSE_UNIVERSE = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BAJFINANCE",
    "WIPRO", "AXISBANK", "KOTAKBANK", "ADANIENT", "ADANIPORTS", "HINDUNILVR",
    "MARUTI", "TATAMOTORS", "TATASTEEL", "SUNPHARMA", "BHARTIARTL", "ITC",
    "LT", "HCLTECH", "ASIANPAINT", "ULTRACEMCO", "NTPC", "POWERGRID",
    "ONGC", "COALINDIA", "JSWSTEEL", "GRASIM", "TECHM", "DRREDDY",
    "DIVISLAB", "CIPLA", "EICHERMOT", "BAJAJFINSV", "TITAN", "NESTLEIND",
    "APOLLOHOSP", "TATACONSUM", "HEROMOTOCO", "BPCL", "INDUSINDBK",
]

SECTOR_MAP = {
    "RELIANCE": "Energy", "ONGC": "Energy", "BPCL": "Energy",
    "TCS": "IT", "INFY": "IT", "WIPRO": "IT", "HCLTECH": "IT", "TECHM": "IT",
    "HDFCBANK": "Banking", "ICICIBANK": "Banking", "SBIN": "Banking",
    "AXISBANK": "Banking", "KOTAKBANK": "Banking", "INDUSINDBK": "Banking",
    "BAJFINANCE": "NBFC", "BAJAJFINSV": "NBFC",
    "ADANIENT": "Conglomerate", "ADANIPORTS": "Infrastructure",
    "HINDUNILVR": "FMCG", "ITC": "FMCG", "NESTLEIND": "FMCG", "TATACONSUM": "FMCG",
    "MARUTI": "Auto", "TATAMOTORS": "Auto", "HEROMOTOCO": "Auto", "EICHERMOT": "Auto",
    "TATASTEEL": "Metals", "JSWSTEEL": "Metals", "COALINDIA": "Metals",
    "SUNPHARMA": "Pharma", "DRREDDY": "Pharma", "DIVISLAB": "Pharma", "CIPLA": "Pharma",
    "BHARTIARTL": "Telecom",
    "LT": "Infrastructure", "NTPC": "Power", "POWERGRID": "Power",
    "GRASIM": "Diversified", "ULTRACEMCO": "Cement",
    "ASIANPAINT": "Paint", "TITAN": "Consumer", "APOLLOHOSP": "Healthcare",
}


def fetch_ohlcv_angel(symbol: str, days: int = 90) -> list[dict]:
    token, exchange, trading_symbol = get_symbol_token(symbol)
    if not token:
        return []
    to_date   = datetime.now()
    from_date = to_date - timedelta(days=days)
    params = {
        "exchange":    exchange,
        "symboltoken": token,
        "interval":    "ONE_DAY",
        "fromdate":    from_date.strftime("%Y-%m-%d %H:%M"),
        "todate":      to_date.strftime("%Y-%m-%d %H:%M"),
    }
    _throttle()
    resp = get_session().getCandleData(params)
    if not resp.get("status") or not resp.get("data"):
        return []
    return [
        {
            "close":  round(float(r[4]), 2),
            "high":   round(float(r[2]), 2),
            "low":    round(float(r[3]), 2),
            "volume": int(r[5]),
        }
        for r in resp["data"]
    ]


def ema_series(prices: list[float], period: int) -> list[float]:
    if len(prices) < period:
        return []
    k = 2 / (period + 1)
    e = [sum(prices[:period]) / period]
    for p in prices[period:]:
        e.append(p * k + e[-1] * (1 - k))
    return e


def calc_rsi(prices: list[float], period: int = 14) -> float | None:
    if len(prices) < period + 1:
        return None
    gains = [max(prices[i]-prices[i-1], 0) for i in range(1, len(prices))]
    losses= [max(prices[i-1]-prices[i], 0) for i in range(1, len(prices))]
    ag = sum(gains[:period]) / period
    al = sum(losses[:period]) / period
    for i in range(period, len(prices)-1):
        ag = (ag*(period-1) + gains[i]) / period
        al = (al*(period-1) + losses[i]) / period
    return round(100 - 100/(1 + ag/al), 2) if al else 100.0


def yf_fundamentals(symbol: str) -> dict:
    try:
        info = yf.Ticker(f"{symbol}.NS").info or {}
        return {
            "name":       info.get("longName") or info.get("shortName") or symbol,
            "market_cap": info.get("marketCap", 0),
            "pe_ratio":   round(info.get("trailingPE", 0) or 0, 2),
            "roe":        round((info.get("returnOnEquity", 0) or 0) * 100, 2),
            "debt_equity":round(info.get("debtToEquity", 0) or 0, 2),
        }
    except Exception:
        return {"name": symbol, "market_cap": 0, "pe_ratio": 0, "roe": 0, "debt_equity": 0}


@router.get("/screen")
def screen_stocks(
    authorization: str = Header(...),
    min_price:  float = 0,
    max_price:  float = 999999,
    trend:      str   = "any",
    risk:       str   = "any",
    min_volume: int   = 0,
    sector:     str   = "any",
):
    get_user_from_token(authorization)
    results = []

    for symbol in NSE_UNIVERSE:
        try:
            # ── Price ────────────────────────────────────────────────────────
            token, exchange, ts = get_symbol_token(symbol)
            if not token:
                continue

            _throttle()
            ltp_resp = ltp_data(exchange, ts, token)
            if not ltp_resp.get("status") or not ltp_resp.get("data"):
                continue

            d = ltp_resp["data"]
            current_price = round(float(d["ltp"]), 2)
            set_price(symbol, current_price)

            if current_price < min_price or current_price > max_price:
                continue

            # ── OHLCV history ────────────────────────────────────────────────
            candles = fetch_ohlcv_angel(symbol, days=250)  # 1Y for EMA 200
            if len(candles) < 30:
                continue

            closes  = [c["close"]  for c in candles]
            volumes = [c["volume"] for c in candles]

            # ── Indicators ───────────────────────────────────────────────────
            ema20  = ema_series(closes, 20)
            ema50  = ema_series(closes, 50)
            ema200 = ema_series(closes, 200)
            rsi_val= calc_rsi(closes)
            vol    = calculate_volatility(closes)
            sma7   = simple_moving_average(closes, 7)

            # Trend
            above_50ema  = ema50  and current_price > ema50[-1]
            above_200ema = ema200 and current_price > ema200[-1]

            # Golden cross: 50 EMA crossed above 200 EMA in last 15 days
            golden_cross = False
            if len(ema50) >= 15 and len(ema200) >= 15:
                for i in range(-15, -1):
                    if ema50[i-1] < ema200[i-1] and ema50[i] >= ema200[i]:
                        golden_cross = True
                        break

            stock_trend = "Upward" if len(sma7) >= 2 and sma7[-1] > sma7[-2] else "Downward"

            # Volume behavior (avg 10d vs avg 30d)
            avg_vol_10 = sum(volumes[-10:]) / 10 if len(volumes) >= 10 else 0
            avg_vol_30 = sum(volumes[-30:]) / 30 if len(volumes) >= 30 else 0
            vol_expanding = avg_vol_10 > avg_vol_30 * 1.2

            # Risk
            risk_level = "Low" if vol < 15 else "Medium" if vol < 30 else "High"

            # 1M change
            change_1mo = round(((closes[-1] - closes[-22]) / closes[-22]) * 100, 2) if len(closes) >= 22 else 0

            # EMA alignment signal
            ema_aligned = above_50ema and above_200ema
            ema_status  = (
                "Above 50 & 200 EMA" if ema_aligned else
                "Above 50 EMA only"  if above_50ema else
                "Below key EMAs"
            )

            # Sector filter
            stock_sector = SECTOR_MAP.get(symbol, "Other")
            if sector != "any" and stock_sector.lower() != sector.lower():
                continue

            # Trend filter
            if trend != "any" and stock_trend.lower() != trend.lower():
                continue

            # Risk filter
            if risk != "any" and risk_level.lower() != risk.lower():
                continue

            # Volume filter
            if avg_vol_10 < min_volume:
                continue

            # Fundamentals
            fund = yf_fundamentals(symbol)

            results.append({
                "ticker":       symbol,
                "name":         fund["name"],
                "sector":       stock_sector,
                "price":        current_price,
                "change_1mo":   change_1mo,
                "volume":       int(avg_vol_10),
                "vol_expanding":vol_expanding,
                "volatility":   round(vol, 2),
                "trend":        stock_trend,
                "risk":         risk_level,
                "rsi":          rsi_val,
                "ema_status":   ema_status,
                "above_50ema":  above_50ema,
                "above_200ema": above_200ema,
                "golden_cross": golden_cross,
                "pe_ratio":     fund["pe_ratio"],
                "roe":          fund["roe"],
                "debt_equity":  fund["debt_equity"],
                "market_cap":   fund["market_cap"],
            })

        except Exception as e:
            print(f"[screener] {symbol} error: {e}")
            continue

    results.sort(key=lambda x: x["change_1mo"], reverse=True)
    return results


@router.post("/ai-screen")
def ai_screen(authorization: str = Header(...), filters: dict = {}):
    """
    Run the screener then pass results to AI quant analyst for
    high-probability setup identification.
    """
    get_user_from_token(authorization)

    # First run the basic screen with no filters to get all stocks
    all_stocks = screen_stocks.__wrapped__ if hasattr(screen_stocks, '__wrapped__') else []

    # Build a summary for the AI
    if not all_stocks:
        # Run a fresh screen
        from fastapi import Request
        pass

    prompt = f"""Current NSE Universe scan — {len(all_stocks)} stocks analysed.

Top movers (1M):
{chr(10).join([f"- {s['ticker']} ({s['sector']}): {s['change_1mo']:+.1f}% | RSI {s['rsi']} | {s['ema_status']} | Vol expanding: {s['vol_expanding']}" for s in all_stocks[:20]])}

Identify high-probability setups. Apply your framework strictly."""

    response = get_ai_response(message=prompt, portfolio_context="", conversation_history=[])
    return {"analysis": response, "stocks_scanned": len(all_stocks)}