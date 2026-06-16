"""
app/services/analysis/data.py

Data-fetching layer — Angel One OHLCV + yfinance fundamentals.
All functions return clean, typed dicts. No business logic here.
"""

from datetime import datetime, timedelta
from typing import Optional
import yfinance as yf

from app.services.instruments import get_symbol_token
from app.services.angel_one import get_session, _throttle


# ── OHLCV ─────────────────────────────────────────────────────────────────────

INTERVAL_MAP = {
    "intraday":   ("ONE_MINUTE",  1),
    "swing":      ("ONE_DAY",    90),
    "long_term":  ("ONE_DAY",   365),
}


def fetch_ohlcv(symbol: str, timeframe: str = "swing") -> list[dict]:
    """
    Returns list of {time, open, high, low, close, volume} dicts.
    timeframe: 'intraday' | 'swing' | 'long_term'
    """
    token, exchange, trading_symbol = get_symbol_token(symbol)
    if not token:
        raise ValueError(f"Symbol '{symbol}' not found on NSE/BSE")

    interval, days = INTERVAL_MAP.get(timeframe, ("ONE_DAY", 90))
    to_date   = datetime.now()
    from_date = to_date - timedelta(days=days)

    params = {
        "exchange":    exchange,
        "symboltoken": token,
        "interval":    interval,
        "fromdate":    from_date.strftime("%Y-%m-%d %H:%M"),
        "todate":      to_date.strftime("%Y-%m-%d %H:%M"),
    }

    _throttle()
    resp = get_session().getCandleData(params)

    if not resp.get("status") or not resp.get("data"):
        raise ValueError(f"Angel One candle fetch failed: {resp.get('message', 'unknown error')}")

    return [
        {
            "time":   row[0][:10],
            "open":   round(float(row[1]), 2),
            "high":   round(float(row[2]), 2),
            "low":    round(float(row[3]), 2),
            "close":  round(float(row[4]), 2),
            "volume": int(row[5]),
        }
        for row in resp["data"]
    ]


def fetch_live_price(symbol: str) -> Optional[float]:
    from app.services.price_cache import get_price_or_fetch
    try:
        return get_price_or_fetch(symbol)
    except Exception:
        return None


# ── Fundamentals (yfinance .NS) ───────────────────────────────────────────────

def fetch_fundamentals(symbol: str) -> dict:
    """
    Fetches fundamental data from yfinance using NSE suffix.
    Falls back gracefully — never raises.
    """
    info = {}
    for suffix in [f"{symbol}.NS", f"{symbol}.BO", symbol]:
        try:
            raw  = yf.Ticker(suffix).info or {}
            if raw.get("shortName") or raw.get("longName"):
                info = raw
                break
        except Exception:
            continue

    def safe(key, default=None, scale=1.0, pct=False):
        val = info.get(key)
        if val is None:
            return default
        try:
            v = float(val) * scale
            return round(v * 100, 2) if pct else round(v, 2)
        except Exception:
            return default

    return {
        "name":             info.get("longName") or info.get("shortName") or symbol,
        "sector":           info.get("sector", "—"),
        "industry":         info.get("industry", "—"),
        "market_cap":       safe("marketCap"),
        "pe_ratio":         safe("trailingPE"),
        "forward_pe":       safe("forwardPE"),
        "pb_ratio":         safe("priceToBook"),
        "ps_ratio":         safe("priceToSalesTrailing12Months"),
        "eps":              safe("trailingEps"),
        "revenue_growth":   safe("revenueGrowth",  pct=True),
        "earnings_growth":  safe("earningsGrowth", pct=True),
        "roe":              safe("returnOnEquity",  pct=True),
        "roa":              safe("returnOnAssets",  pct=True),
        "roce":             safe("returnOnEquity",  pct=True),   # proxy — ROCE not in yf
        "debt_equity":      safe("debtToEquity"),
        "current_ratio":    safe("currentRatio"),
        "quick_ratio":      safe("quickRatio"),
        "dividend_yield":   safe("dividendYield", pct=True),
        "payout_ratio":     safe("payoutRatio",   pct=True),
        "gross_margin":     safe("grossMargins",  pct=True),
        "operating_margin": safe("operatingMargins", pct=True),
        "profit_margin":    safe("profitMargins",    pct=True),
        "beta":             safe("beta"),
        "52w_high":         safe("fiftyTwoWeekHigh"),
        "52w_low":          safe("fiftyTwoWeekLow"),
        "avg_volume_30d":   safe("averageVolume"),
        "float_shares":     safe("floatShares"),
    }


# ── Smart Money (mocked — Angel One does not expose FII/DII data via retail API) ──

def fetch_smart_money(symbol: str) -> dict:
    """
    Returns promoter/FII/DII holding trends.
    Uses yfinance institutional holders as proxy.
    """
    holdings = {
        "promoter_holding_pct":   None,
        "fii_holding_pct":        None,
        "dii_holding_pct":        None,
        "retail_holding_pct":     None,
        "promoter_trend":         "unknown",
        "fii_trend":              "unknown",
        "institutional_holders":  [],
    }

    try:
        t = yf.Ticker(f"{symbol}.NS")
        inst = t.institutional_holders
        if inst is not None and not inst.empty:
            top = inst.head(5).to_dict("records")
            holdings["institutional_holders"] = [
                {
                    "name":       str(row.get("Holder", "")),
                    "pct_held":   round(float(row.get("% Out", 0)) * 100, 2),
                    "shares":     int(row.get("Shares", 0)),
                }
                for row in top
            ]
    except Exception:
        pass

    return holdings