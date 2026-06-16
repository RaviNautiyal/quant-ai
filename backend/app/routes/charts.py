"""
app/routes/charts.py
────────────────────
Chart data endpoints — OHLCV + technical indicators.
Uses Angel One for live/recent data, yfinance as fallback.

Add to app/main.py:
    from app.routes import charts
    app.include_router(charts.router, prefix="/charts", tags=["charts"])

Requires: yfinance, pandas, numpy, ta (pip install ta)
    pip install ta
"""

from fastapi import APIRouter, Depends, Query
from app.utils.auth import get_current_user
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

router = APIRouter()

# ── helpers ──────────────────────────────────────────────────────────────────

def _normalize(ticker: str) -> str:
    t = ticker.strip().upper().replace(" ", "")
    if "." in t or t.startswith("^"):
        return t
    return t + ".NS"

TIMEFRAME_MAP = {
    "1d":  ("1d",  "5m"),    # (yf period, yf interval)
    "1w":  ("5d",  "30m"),
    "1m":  ("1mo", "1d"),
    "3m":  ("3mo", "1d"),
    "6m":  ("6mo", "1d"),
    "1y":  ("1y",  "1wk"),
    "3y":  ("3y",  "1wk"),
    "5y":  ("5y",  "1mo"),
}

def _date_fmt(ts, interval: str) -> str:
    if interval in ("5m", "30m", "1h"):
        return ts.strftime("%H:%M") if hasattr(ts, "strftime") else str(ts)[:16]
    if interval in ("1wk", "1mo"):
        return ts.strftime("%b %y") if hasattr(ts, "strftime") else str(ts)[:7]
    return ts.strftime("%d %b") if hasattr(ts, "strftime") else str(ts)[:10]

def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()

def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    rs    = gain / loss.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).round(2)

def _macd(series: pd.Series):
    ema12 = _ema(series, 12)
    ema26 = _ema(series, 26)
    macd  = ema12 - ema26
    signal= _ema(macd, 9)
    hist  = macd - signal
    return macd.round(2), signal.round(2), hist.round(2)

def _bollinger(series: pd.Series, period: int = 20):
    mid   = series.rolling(period).mean()
    std   = series.rolling(period).std()
    upper = (mid + 2 * std).round(2)
    lower = (mid - 2 * std).round(2)
    return upper, mid.round(2), lower

def _safe(val) -> float | None:
    try:
        v = float(val)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, 2)
    except Exception:
        return None

# ── GET /charts/ohlcv ────────────────────────────────────────────────────────

@router.get("/ohlcv")
async def get_ohlcv(
    ticker:     str  = Query(...),
    timeframe:  str  = Query("3m"),
    indicators: str  = Query("ema20,volume"),
    user=Depends(get_current_user),
):
    """
    Returns OHLCV candles + requested indicator columns.
    indicators = comma-separated subset of:
        ema20, ema50, ema200, bb, rsi, macd, volume
    """
    period, interval = TIMEFRAME_MAP.get(timeframe, ("3mo", "1d"))
    ind_list = [i.strip() for i in indicators.split(",") if i.strip()]

    try:
        df = yf.download(
            _normalize(ticker),
            period=period,
            interval=interval,
            auto_adjust=True,
            progress=False,
        )
    except Exception as e:
        return []

    if df.empty:
        return []

    # Flatten multi-index columns if present (yfinance ≥ 0.2)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.rename(columns=str.capitalize)
    df = df.dropna(subset=["Close"])

    close  = df["Close"]
    result = []

    # Pre-compute indicators
    ema20_s  = _ema(close, 20)  if "ema20"  in ind_list else None
    ema50_s  = _ema(close, 50)  if "ema50"  in ind_list else None
    ema200_s = _ema(close, 200) if "ema200" in ind_list else None
    bb_u, bb_m, bb_l = _bollinger(close) if "bb" in ind_list else (None, None, None)
    rsi_s           = _rsi(close)        if "rsi"  in ind_list else None
    macd_s, macd_sig, macd_hist = _macd(close) if "macd" in ind_list else (None, None, None)

    for ts, row in df.iterrows():
        candle: dict = {
            "date":   _date_fmt(ts, interval),
            "open":   _safe(row.get("Open",  row.get("open"))),
            "high":   _safe(row.get("High",  row.get("high"))),
            "low":    _safe(row.get("Low",   row.get("low"))),
            "close":  _safe(row.get("Close", row.get("close"))),
            "volume": _safe(row.get("Volume",row.get("volume"))),
        }

        # Only include indicator fields that were requested
        if ema20_s  is not None: candle["ema20"]       = _safe(ema20_s.get(ts))
        if ema50_s  is not None: candle["ema50"]       = _safe(ema50_s.get(ts))
        if ema200_s is not None: candle["ema200"]      = _safe(ema200_s.get(ts))
        if bb_u     is not None:
            candle["bb_upper"] = _safe(bb_u.get(ts))
            candle["bb_mid"]   = _safe(bb_m.get(ts))
            candle["bb_lower"] = _safe(bb_l.get(ts))
        if rsi_s    is not None: candle["rsi"]         = _safe(rsi_s.get(ts))
        if macd_s   is not None:
            candle["macd"]        = _safe(macd_s.get(ts))
            candle["macd_signal"] = _safe(macd_sig.get(ts))
            candle["macd_hist"]   = _safe(macd_hist.get(ts))

        # Skip candles where close is missing
        if candle["close"] is None:
            continue

        result.append(candle)

    return result

# ── GET /charts/info ─────────────────────────────────────────────────────────

@router.get("/info")
async def get_info(
    ticker: str = Query(...),
    user=Depends(get_current_user),
):
    """Returns basic stock info — name, sector, market cap, etc."""
    try:
        info = yf.Ticker(_normalize(ticker)).info
        return {
            "ticker":      ticker.upper(),
            "name":        info.get("longName", ticker),
            "sector":      info.get("sector", ""),
            "industry":    info.get("industry", ""),
            "market_cap":  info.get("marketCap"),
            "pe_ratio":    info.get("trailingPE"),
            "52w_high":    info.get("fiftyTwoWeekHigh"),
            "52w_low":     info.get("fiftyTwoWeekLow"),
            "avg_volume":  info.get("averageVolume"),
            "description": info.get("longBusinessSummary", "")[:300],
        }
    except Exception:
        return {"ticker": ticker.upper(), "name": ticker}