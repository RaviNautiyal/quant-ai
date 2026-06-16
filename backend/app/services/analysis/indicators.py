"""
app/services/analysis/indicators.py

Pure technical indicator functions.
All take a list[float] of closing prices (and optionally highs/lows/volumes).
All return clean typed values — no side effects.
"""

import math
from typing import Optional


# ── Moving Averages ───────────────────────────────────────────────────────────

def sma(prices: list[float], period: int) -> list[float]:
    if len(prices) < period:
        return []
    return [
        round(sum(prices[i:i+period]) / period, 2)
        for i in range(len(prices) - period + 1)
    ]


def ema(prices: list[float], period: int) -> list[float]:
    if len(prices) < period:
        return []
    k = 2 / (period + 1)
    result = [round(sum(prices[:period]) / period, 2)]
    for price in prices[period:]:
        result.append(round(price * k + result[-1] * (1 - k), 2))
    return result


# ── RSI ───────────────────────────────────────────────────────────────────────

def rsi(prices: list[float], period: int = 14) -> list[float]:
    if len(prices) < period + 1:
        return []
    gains, losses = [], []
    for i in range(1, len(prices)):
        d = prices[i] - prices[i-1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    ag = sum(gains[:period]) / period
    al = sum(losses[:period]) / period
    result = []
    for i in range(period, len(prices)):
        result.append(round(100 - 100 / (1 + ag / al), 2) if al else 100.0)
        ag = (ag * (period-1) + gains[i-1]) / period
        al = (al * (period-1) + losses[i-1]) / period
    return result


def rsi_signal(rsi_val: float) -> str:
    if rsi_val >= 70: return "overbought"
    if rsi_val <= 30: return "oversold"
    if rsi_val >= 60: return "bullish"
    if rsi_val <= 40: return "bearish"
    return "neutral"


# ── MACD ──────────────────────────────────────────────────────────────────────

def macd(prices: list[float], fast=12, slow=26, signal_period=9) -> dict:
    if len(prices) < slow:
        return {"macd": [], "signal": [], "histogram": [], "current": None}
    fe   = ema(prices, fast)
    se   = ema(prices, slow)
    line = [round(f - s, 4) for f, s in zip(fe, se)]
    sig  = ema(line, signal_period)
    hist = [round(m - s, 4) for m, s in zip(line, sig)]
    return {
        "macd":      line,
        "signal":    sig,
        "histogram": hist,
        "current":   {
            "macd":      line[-1]  if line  else None,
            "signal":    sig[-1]   if sig   else None,
            "histogram": hist[-1]  if hist  else None,
            "crossover": (
                "bullish_crossover" if len(hist) >= 2 and hist[-2] < 0 and hist[-1] >= 0 else
                "bearish_crossover" if len(hist) >= 2 and hist[-2] > 0 and hist[-1] <= 0 else
                "bullish" if hist and hist[-1] > 0 else
                "bearish"
            )
        }
    }


# ── Bollinger Bands ───────────────────────────────────────────────────────────

def bollinger_bands(prices: list[float], period=20, std_dev=2.0) -> dict:
    if len(prices) < period:
        return {"upper": None, "middle": None, "lower": None, "signal": "insufficient_data"}
    window = prices[-period:]
    mid    = sum(window) / period
    std    = math.sqrt(sum((p - mid) ** 2 for p in window) / period)
    upper  = round(mid + std_dev * std, 2)
    lower  = round(mid - std_dev * std, 2)
    mid    = round(mid, 2)
    last   = prices[-1]
    signal = (
        "overbought" if last > upper else
        "oversold"   if last < lower else
        "upper_half" if last > mid   else
        "lower_half"
    )
    return {
        "upper":  upper,
        "middle": mid,
        "lower":  lower,
        "bandwidth": round((upper - lower) / mid * 100, 2),
        "signal": signal,
    }


# ── Support / Resistance ──────────────────────────────────────────────────────

def support_resistance(
    highs: list[float],
    lows:  list[float],
    prices: list[float],
    lookback: int = 20
) -> dict:
    """
    Pivot-point based support/resistance.
    Returns key levels and proximity signals.
    """
    if len(highs) < lookback or len(lows) < lookback:
        return {"support": [], "resistance": [], "nearest_support": None, "nearest_resistance": None}

    recent_highs = highs[-lookback:]
    recent_lows  = lows[-lookback:]
    current      = prices[-1]

    # Swing highs / lows (simple local extrema)
    resistance_levels = sorted(set(
        round(h, 0) for i, h in enumerate(recent_highs[1:-1], 1)
        if h >= recent_highs[i-1] and h >= recent_highs[i+1]
    ), reverse=True)[:3]

    support_levels = sorted(set(
        round(l, 0) for i, l in enumerate(recent_lows[1:-1], 1)
        if l <= recent_lows[i-1] and l <= recent_lows[i+1]
    ))[:3]

    # Fallback: use period high/low as levels
    if not resistance_levels:
        resistance_levels = [round(max(recent_highs), 2)]
    if not support_levels:
        support_levels = [round(min(recent_lows), 2)]

    nearest_res = min(resistance_levels, key=lambda x: abs(x - current)) if resistance_levels else None
    nearest_sup = max(support_levels,    key=lambda x: abs(x - current)) if support_levels    else None

    return {
        "support":            support_levels,
        "resistance":         resistance_levels,
        "nearest_support":    nearest_sup,
        "nearest_resistance": nearest_res,
        "pct_to_resistance":  round((nearest_res - current) / current * 100, 2) if nearest_res else None,
        "pct_to_support":     round((current - nearest_sup) / current * 100, 2) if nearest_sup else None,
    }


# ── Volatility & Risk ─────────────────────────────────────────────────────────

def volatility(prices: list[float]) -> float:
    if len(prices) < 2:
        return 0.0
    returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
    mean    = sum(returns) / len(returns)
    std     = math.sqrt(sum((r - mean) ** 2 for r in returns) / len(returns))
    return round(std * math.sqrt(252) * 100, 2)  # annualised %


def sharpe_ratio(prices: list[float], risk_free: float = 0.065) -> float:
    """Annualised Sharpe. risk_free default = 6.5% (India 10Y G-sec proxy)."""
    if len(prices) < 2:
        return 0.0
    returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
    if not returns:
        return 0.0
    mean    = sum(returns) / len(returns)
    std     = math.sqrt(sum((r - mean) ** 2 for r in returns) / len(returns))
    if std == 0:
        return 0.0
    ann_ret = mean * 252
    ann_std = std * math.sqrt(252)
    return round((ann_ret - risk_free) / ann_std, 2)


def max_drawdown(prices: list[float]) -> float:
    """Maximum peak-to-trough drawdown %."""
    if len(prices) < 2:
        return 0.0
    peak = prices[0]
    mdd  = 0.0
    for p in prices:
        if p > peak:
            peak = p
        dd = (peak - p) / peak
        if dd > mdd:
            mdd = dd
    return round(mdd * 100, 2)


# ── Volume Analysis ───────────────────────────────────────────────────────────

def volume_trend(volumes: list[int], prices: list[float], period: int = 10) -> dict:
    if len(volumes) < period or len(prices) < period:
        return {"signal": "insufficient_data", "avg_volume": None}

    avg_vol     = round(sum(volumes[-period:]) / period)
    latest_vol  = volumes[-1]
    vol_ratio   = round(latest_vol / avg_vol, 2) if avg_vol else 0
    price_trend = "up" if prices[-1] > prices[-period] else "down"

    # Volume-price confluence
    signal = (
        "strong_bullish" if vol_ratio > 1.5 and price_trend == "up"   else
        "strong_bearish" if vol_ratio > 1.5 and price_trend == "down" else
        "weak_rally"     if vol_ratio < 0.7 and price_trend == "up"   else
        "weak_decline"   if vol_ratio < 0.7 and price_trend == "down" else
        "neutral"
    )

    return {
        "signal":        signal,
        "avg_volume":    avg_vol,
        "latest_volume": latest_vol,
        "volume_ratio":  vol_ratio,
        "price_trend":   price_trend,
    }


# ── Trade Setup ───────────────────────────────────────────────────────────────

def trade_setup(
    current_price: float,
    support: Optional[float],
    resistance: Optional[float],
    atr_pct: float = 2.0,
) -> dict:
    """
    Generates entry, stop-loss, targets based on support/resistance.
    atr_pct: approximate ATR as % of price (used when S/R unavailable).
    """
    if not support or not resistance:
        atr    = current_price * atr_pct / 100
        return {
            "entry":     round(current_price, 2),
            "stop_loss": round(current_price - atr, 2),
            "targets":   [
                round(current_price + atr,     2),
                round(current_price + atr * 2, 2),
                round(current_price + atr * 3, 2),
            ],
            "risk_reward": "1:1 / 1:2 / 1:3",
        }

    risk       = current_price - support
    target_1   = round(current_price + risk,       2)
    target_2   = round(current_price + risk * 2,   2)
    target_3   = round(resistance,                 2)
    stop_loss  = round(support * 0.99,             2)  # 1% below support
    rr         = round((target_1 - current_price) / (current_price - stop_loss), 2) if current_price != stop_loss else 0

    return {
        "entry":       round(current_price, 2),
        "stop_loss":   stop_loss,
        "targets":     [target_1, target_2, target_3],
        "risk_reward": f"1:{rr}",
        "risk_pct":    round((current_price - stop_loss) / current_price * 100, 2),
    }