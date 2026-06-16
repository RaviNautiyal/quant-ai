from fastapi import APIRouter, Header, HTTPException
from app.utils.auth import decode_token
from app.services.algorithms import simple_moving_average, calculate_volatility, sharpe_ratio
from app.services.instruments import get_symbol_token, get_live_price
from app.services.angel_one import get_session, _throttle
from datetime import datetime, timedelta
import yfinance as yf

router = APIRouter()

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email


def fetch_candles(symbol: str, days: int = 90) -> list[dict]:
    token, exchange, trading_symbol = get_symbol_token(symbol)
    if not token:
        raise ValueError(f"Symbol '{symbol}' not found on NSE/BSE")

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
        raise ValueError(f"No candle data for {symbol}")

    return [
        {
            "time":  row[0][:10],
            "open":  round(float(row[1]), 2),
            "high":  round(float(row[2]), 2),
            "low":   round(float(row[3]), 2),
            "close": round(float(row[4]), 2),
            "volume": int(row[5]),
        }
        for row in resp["data"]
    ]


def yf_meta(symbol: str) -> dict:
    """Fetch fundamental metadata from yfinance using .NS suffix."""
    info = {}
    for suffix in [f"{symbol}.NS", f"{symbol}.BO", symbol]:
        try:
            info = yf.Ticker(suffix).info or {}
            if info.get("shortName") or info.get("longName"):
                break
        except Exception:
            continue
    return info


@router.get("/compare")
def compare_stocks(tickers: str, authorization: str = Header(...)):
    get_user_from_token(authorization)

    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:3]
    if len(ticker_list) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 symbols")

    results = []

    for symbol in ticker_list:
        try:
            # ── OHLCV from Angel One ──────────────────────────────────────────
            candles = fetch_candles(symbol, days=90)
            if not candles:
                continue

            prices = [c["close"] for c in candles]
            dates  = [c["time"]  for c in candles]
            highs  = [c["high"]  for c in candles]
            lows   = [c["low"]   for c in candles]
            vols   = [c["volume"] for c in candles]

            # ── Live price ────────────────────────────────────────────────────
            try:
                current_price = get_live_price(symbol)
            except Exception:
                current_price = prices[-1]

            # ── Price metrics ─────────────────────────────────────────────────
            change_3mo   = round(((prices[-1] - prices[0]) / prices[0]) * 100, 2) if prices[0] else 0
            change_1mo   = round(((prices[-1] - prices[-22]) / prices[-22]) * 100, 2) if len(prices) >= 22 else 0
            change_1w    = round(((prices[-1] - prices[-6])  / prices[-6])  * 100, 2) if len(prices) >= 6 else 0
            high_3mo     = round(max(highs), 2)
            low_3mo      = round(min(lows), 2)
            avg_volume   = round(sum(vols) / len(vols)) if vols else 0

            # ── Technical indicators ──────────────────────────────────────────
            volatility = calculate_volatility(prices)
            sharpe     = sharpe_ratio(prices)
            sma7       = simple_moving_average(prices, 7)
            sma20      = simple_moving_average(prices, 20)
            trend      = "Upward" if len(sma7) >= 2 and sma7[-1] > sma7[-2] else "Downward"

            # RSI
            def rsi(p, period=14):
                if len(p) < period + 1: return None
                gains = [max(p[i]-p[i-1], 0) for i in range(1, len(p))]
                losses= [max(p[i-1]-p[i], 0) for i in range(1, len(p))]
                ag = sum(gains[:period]) / period
                al = sum(losses[:period]) / period
                for i in range(period, len(p)-1):
                    ag = (ag*(period-1) + gains[i]) / period
                    al = (al*(period-1) + losses[i]) / period
                return round(100 - 100/(1 + ag/al), 2) if al else 100

            current_rsi = rsi(prices)

            # Distance from 3M high/low
            pct_from_high = round(((current_price - high_3mo) / high_3mo) * 100, 2)
            pct_from_low  = round(((current_price - low_3mo)  / low_3mo)  * 100, 2)

            # SMA crossover signal
            if sma7 and sma20:
                signal = "BUY"  if sma7[-1] > sma20[-1] else "SELL"
            else:
                signal = "NEUTRAL"

            # ── Fundamentals from yfinance ────────────────────────────────────
            meta = yf_meta(symbol)
            name          = meta.get("longName") or meta.get("shortName") or symbol
            pe_ratio      = round(meta.get("trailingPE",   0) or 0, 2)
            pb_ratio      = round(meta.get("priceToBook",  0) or 0, 2)
            market_cap    = meta.get("marketCap", 0) or 0
            div_yield     = round((meta.get("dividendYield", 0) or 0) * 100, 2)
            roe           = round((meta.get("returnOnEquity", 0) or 0) * 100, 2)
            debt_equity   = round(meta.get("debtToEquity",  0) or 0, 2)
            eps           = round(meta.get("trailingEps",   0) or 0, 2)
            week52_high   = round(meta.get("fiftyTwoWeekHigh", high_3mo) or high_3mo, 2)
            week52_low    = round(meta.get("fiftyTwoWeekLow",  low_3mo)  or low_3mo,  2)
            beta          = round(meta.get("beta", 0) or 0, 2)

            results.append({
                "ticker":        symbol,
                "name":          name,

                # Prices
                "current_price": round(current_price, 2),
                "change_1w":     change_1w,
                "change_1mo":    change_1mo,
                "change_3mo":    change_3mo,
                "high_3mo":      high_3mo,
                "low_3mo":       low_3mo,
                "52w_high":      week52_high,
                "52w_low":       week52_low,
                "pct_from_high": pct_from_high,
                "pct_from_low":  pct_from_low,

                # Technical
                "volatility":    volatility,
                "sharpe_ratio":  sharpe,
                "rsi":           current_rsi,
                "trend":         trend,
                "signal":        signal,
                "avg_volume":    avg_volume,
                "beta":          beta,

                # Fundamental
                "pe_ratio":      pe_ratio,
                "pb_ratio":      pb_ratio,
                "market_cap":    market_cap,
                "dividend_yield": div_yield,
                "roe":           roe,
                "debt_equity":   debt_equity,
                "eps":           eps,

                # Chart data
                "prices": [round(p, 2) for p in prices],
                "dates":  dates,
            })

        except Exception as e:
            print(f"[comparison] {symbol} error: {e}")
            continue

    if len(results) < 2:
        raise HTTPException(status_code=422, detail="Could not fetch data for enough symbols. Check that symbols are valid NSE tickers.")

    return results