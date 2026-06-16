"""
app/services/analysis/analysis.py

Orchestrates data + indicators into a final structured analysis.
Single entry point: run_analysis(symbol, timeframe) → dict
"""

from .data import fetch_ohlcv, fetch_live_price, fetch_fundamentals, fetch_smart_money
from .indicators import (
    sma, ema, rsi, rsi_signal, macd, bollinger_bands,
    support_resistance, volatility, sharpe_ratio, max_drawdown,
    volume_trend, trade_setup,
)
from typing import Optional


# ── Scoring engine ────────────────────────────────────────────────────────────

def _score(
    fundamentals: dict,
    technicals:   dict,
    smart_money:  dict,
) -> dict:
    """
    Returns a 0–100 confidence score and component breakdown.
    Higher = more bullish conviction.
    """
    scores = {}

    # ── Technical score (0–50) ────────────────────────────────────────────────
    tech_pts = 0

    # Trend (0–10)
    ma_signal = technicals.get("ma_signal", "")
    if "golden_cross"   in ma_signal: tech_pts += 10
    elif "bullish"      in ma_signal: tech_pts += 7
    elif "bearish"      in ma_signal: tech_pts += 3
    elif "death_cross"  in ma_signal: tech_pts += 0
    else:                              tech_pts += 5
    scores["trend"] = tech_pts

    # RSI (0–10)
    rsi_val = technicals.get("rsi_current")
    if rsi_val is not None:
        if 40 <= rsi_val <= 60:   tech_pts += 8   # healthy momentum
        elif 30 <= rsi_val < 40:  tech_pts += 10  # bounce zone
        elif 60 < rsi_val <= 70:  tech_pts += 6   # still ok
        elif rsi_val < 30:        tech_pts += 5   # oversold = opportunity
        else:                      tech_pts += 2   # overbought
    scores["rsi"] = rsi_val

    # MACD (0–10)
    macd_sig = technicals.get("macd", {}).get("current", {})
    if macd_sig:
        cross = macd_sig.get("crossover", "")
        if cross == "bullish_crossover":  tech_pts += 10
        elif cross == "bullish":          tech_pts += 6
        elif cross == "bearish":          tech_pts += 3
        else:                              tech_pts += 0

    # Bollinger (0–5)
    bb_sig = technicals.get("bollinger", {}).get("signal", "")
    if bb_sig == "oversold":   tech_pts += 5
    elif bb_sig == "lower_half": tech_pts += 3
    elif bb_sig == "upper_half": tech_pts += 2

    # Volume (0–5)
    vol_sig = technicals.get("volume", {}).get("signal", "")
    if "strong_bullish" in vol_sig: tech_pts += 5
    elif "bullish"      in vol_sig: tech_pts += 3
    elif "strong_bearish" in vol_sig: tech_pts += 0

    # Sharpe & Drawdown (0–5)
    sr = technicals.get("sharpe_ratio", 0) or 0
    if sr > 1.5:   tech_pts += 5
    elif sr > 0.5: tech_pts += 3
    elif sr < 0:   tech_pts += 0

    scores["technical_total"] = min(tech_pts, 50)

    # ── Fundamental score (0–30) ──────────────────────────────────────────────
    fund_pts = 0

    pe  = fundamentals.get("pe_ratio") or 0
    roe = fundamentals.get("roe")      or 0
    de  = fundamentals.get("debt_equity") or 999
    rev = fundamentals.get("revenue_growth") or 0

    if   0 < pe < 15: fund_pts += 10
    elif 0 < pe < 25: fund_pts += 7
    elif 0 < pe < 40: fund_pts += 4
    else:              fund_pts += 0

    if roe > 20:  fund_pts += 8
    elif roe > 12: fund_pts += 5
    elif roe > 0:  fund_pts += 2

    if de < 0.3:   fund_pts += 7
    elif de < 1.0: fund_pts += 4
    elif de < 2.0: fund_pts += 1

    if rev > 15:  fund_pts += 5
    elif rev > 5: fund_pts += 3

    scores["fundamental_total"] = min(fund_pts, 30)

    # ── Smart money score (0–20) ──────────────────────────────────────────────
    sm_pts  = 10  # neutral base since we often don't have real data
    fii_tr  = smart_money.get("fii_trend", "unknown")
    prom_tr = smart_money.get("promoter_trend", "unknown")

    if fii_tr  == "increasing":  sm_pts += 5
    elif fii_tr == "decreasing": sm_pts -= 5
    if prom_tr == "increasing":  sm_pts += 5
    elif prom_tr == "decreasing": sm_pts -= 3

    scores["smart_money_total"] = max(0, min(sm_pts, 20))

    total = scores["technical_total"] + scores["fundamental_total"] + scores["smart_money_total"]
    scores["total"] = min(total, 100)

    return scores


def _verdict(score: int, technicals: dict, fundamentals: dict) -> dict:
    trend     = technicals.get("trend", "neutral")
    rsi_v     = technicals.get("rsi_current", 50) or 50
    macd_sig  = (technicals.get("macd", {}).get("current") or {}).get("crossover", "")
    pe        = fundamentals.get("pe_ratio") or 0
    roe       = fundamentals.get("roe") or 0

    if score >= 70:
        verdict = "Strongly Bullish"
        emoji   = "🟢"
    elif score >= 55:
        verdict = "Bullish"
        emoji   = "🟩"
    elif score >= 45:
        verdict = "Neutral"
        emoji   = "🟡"
    elif score >= 30:
        verdict = "Bearish"
        emoji   = "🟥"
    else:
        verdict = "Strongly Bearish"
        emoji   = "🔴"

    # Investor view (fundamentals-first)
    if roe > 15 and (pe or 999) < 30:
        inv_view = f"Fundamentally sound with ROE {roe}% and PE {pe}. "
        inv_view += "Suitable for medium-to-long term accumulation." if score >= 55 else "Wait for better entry — technicals are weak."
    elif pe and pe > 50:
        inv_view = f"Expensive at PE {pe}. Avoid unless strong growth justifies premium."
    else:
        inv_view = "Mixed fundamentals. Review quarterly results before investing."

    # Trader view (technicals-first)
    if "golden_cross" in trend or score >= 65:
        trd_view = "Momentum is bullish. Look for breakouts above resistance with volume."
    elif "death_cross" in trend or score <= 35:
        trd_view = "Downtrend in play. Short positions or stay in cash until reversal signals appear."
    elif rsi_v < 35:
        trd_view = "RSI oversold — potential bounce candidate. Wait for confirmation candle."
    elif rsi_v > 70:
        trd_view = "RSI overbought — avoid fresh longs. Book partial profits."
    else:
        trd_view = "Range-bound action. Trade breakouts with strict stop-losses."

    return {
        "verdict":       f"{emoji} {verdict}",
        "score":         score,
        "investor_view": inv_view,
        "trader_view":   trd_view,
    }


def _risks(fundamentals: dict, technicals: dict, score: int) -> list[str]:
    risks = []
    de  = fundamentals.get("debt_equity") or 0
    pe  = fundamentals.get("pe_ratio")    or 0
    vol = technicals.get("volatility")    or 0
    mdd = technicals.get("max_drawdown")  or 0
    rsi_v = technicals.get("rsi_current") or 50
    beta  = fundamentals.get("beta") or 1

    if de > 2:      risks.append(f"High leverage: Debt/Equity at {de}x — interest rate risk.")
    if pe  > 50:    risks.append(f"Valuation risk: PE at {pe}x — priced for perfection.")
    if vol > 40:    risks.append(f"High volatility: {vol}% annualised — suitable only for risk-tolerant investors.")
    if mdd > 30:    risks.append(f"Historical drawdown of {mdd}% — position sizing is critical.")
    if rsi_v > 75:  risks.append("RSI overbought territory — pullback risk in near term.")
    if beta > 1.5:  risks.append(f"High beta ({beta}) — stock moves {beta}x market. Use tighter stop-losses.")
    if score < 30:  risks.append("Multiple bearish signals aligned — high risk of further downside.")

    if not risks:
        risks.append("No major red flags detected. Standard market risk applies.")

    return risks


# ── Main entry point ──────────────────────────────────────────────────────────

def run_analysis(symbol: str, timeframe: str = "swing") -> dict:
    symbol = symbol.upper().strip()

    # 1. Fetch data
    candles      = fetch_ohlcv(symbol, timeframe)
    live_price   = fetch_live_price(symbol) or (candles[-1]["close"] if candles else 0)
    fundamentals = fetch_fundamentals(symbol)
    smart_money  = fetch_smart_money(symbol)

    if not candles:
        raise ValueError(f"No price data available for {symbol}")

    closes  = [c["close"]  for c in candles]
    highs   = [c["high"]   for c in candles]
    lows    = [c["low"]    for c in candles]
    volumes = [c["volume"] for c in candles]
    dates   = [c["time"]   for c in candles]

    # 2. Compute indicators
    sma_50  = sma(closes, 50)
    sma_200 = sma(closes, 200)
    ema_20  = ema(closes, 20)
    rsi_vals= rsi(closes, 14)
    rsi_cur = rsi_vals[-1] if rsi_vals else None
    macd_d  = macd(closes)
    bb      = bollinger_bands(closes)
    sr      = support_resistance(highs, lows, closes)
    vol_pct = volatility(closes)
    sharpe  = sharpe_ratio(closes)
    mdd     = max_drawdown(closes)
    vol_tr  = volume_trend(volumes, closes)

    # 3. MA trend signal
    if sma_50 and sma_200:
        if sma_50[-1] > sma_200[-1] and (len(sma_50) < 2 or sma_50[-2] <= sma_200[-min(2, len(sma_200))]):
            ma_signal = "golden_cross"
        elif sma_50[-1] < sma_200[-1] and (len(sma_50) < 2 or sma_50[-2] >= sma_200[-min(2, len(sma_200))]):
            ma_signal = "death_cross"
        elif sma_50[-1] > sma_200[-1]:
            ma_signal = "bullish_above_200sma"
        else:
            ma_signal = "bearish_below_200sma"
    elif sma_50:
        ma_signal = "bullish" if closes[-1] > sma_50[-1] else "bearish"
    else:
        ma_signal = "insufficient_data"

    # 4. Trade setup
    setup = trade_setup(
        current_price=live_price,
        support=sr.get("nearest_support"),
        resistance=sr.get("nearest_resistance"),
    )

    # 5. Build technicals block
    technicals = {
        "current_price":  round(live_price, 2),
        "trend":          ma_signal,
        "ma_signal":      ma_signal,
        "sma_50":         sma_50[-1]  if sma_50  else None,
        "sma_200":        sma_200[-1] if sma_200 else None,
        "ema_20":         ema_20[-1]  if ema_20  else None,
        "rsi_current":    rsi_cur,
        "rsi_signal":     rsi_signal(rsi_cur) if rsi_cur else None,
        "macd":           macd_d,
        "bollinger":      bb,
        "support_resistance": sr,
        "volatility":     vol_pct,
        "sharpe_ratio":   sharpe,
        "max_drawdown":   mdd,
        "volume":         vol_tr,
        "price_history": {
            "dates":  dates,
            "closes": [round(p, 2) for p in closes],
            "sma_50":  [None] * (len(closes) - len(sma_50))  + sma_50,
            "sma_200": [None] * (len(closes) - len(sma_200)) + sma_200,
            "ema_20":  [None] * (len(closes) - len(ema_20))  + ema_20,
        }
    }

    # 6. Score + verdict
    scores  = _score(fundamentals, technicals, smart_money)
    verdict = _verdict(scores["total"], technicals, fundamentals)
    risks   = _risks(fundamentals, technicals, scores["total"])

    return {
        "stock":         symbol,
        "name":          fundamentals.get("name", symbol),
        "timeframe":     timeframe,
        "fundamentals":  fundamentals,
        "technicals":    technicals,
        "smart_money":   smart_money,
        "risks":         risks,
        "trade_setup":   setup,
        "scoring":       scores,
        "investor_view": verdict["investor_view"],
        "trader_view":   verdict["trader_view"],
        "verdict":       verdict["verdict"],
        "confidence":    scores["total"],
    }