from fastapi import APIRouter, Header, HTTPException
from app.services.algorithms import (
    simple_moving_average,
    exponential_moving_average,
    SegmentTree,
    calculate_volatility,
    portfolio_optimizer,
    sharpe_ratio
)
from app.utils.auth import decode_token
from app.database.db import portfolio_collection
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

# ── Period → days map ─────────────────────────────────────────────────────────
PERIOD_DAYS = {
    "1mo":  30,
    "3mo":  90,
    "6mo":  180,
    "1y":   365,
    "2y":   730,
}

# Angel One interval for each period
PERIOD_INTERVAL = {
    "1mo":  "ONE_DAY",
    "3mo":  "ONE_DAY",
    "6mo":  "ONE_DAY",
    "1y":   "ONE_DAY",
    "2y":   "ONE_DAY",
}


def fetch_candles_angel_one(symbol: str, period: str) -> list[dict]:
    """
    Fetch OHLCV candles from Angel One getCandleData.
    Returns list of {time, open, high, low, close, volume}.
    """
    token, exchange, trading_symbol = get_symbol_token(symbol)
    if not token:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found on NSE/BSE")

    days     = PERIOD_DAYS.get(period, 90)
    interval = PERIOD_INTERVAL.get(period, "ONE_DAY")
    to_date  = datetime.now()
    from_date = to_date - timedelta(days=days)

    params = {
        "exchange":    exchange,
        "symboltoken": token,
        "interval":    interval,
        "fromdate":    from_date.strftime("%Y-%m-%d %H:%M"),
        "todate":      to_date.strftime("%Y-%m-%d %H:%M"),
    }

    _throttle()
    smart_api = get_session()
    resp = smart_api.getCandleData(params)

    if not resp.get("status") or not resp.get("data"):
        raise HTTPException(status_code=502, detail=f"Angel One candle fetch failed: {resp.get('message')}")

    candles = []
    for row in resp["data"]:
        # Angel One format: [timestamp, open, high, low, close, volume]
        ts    = row[0][:10]  # "2024-01-15T09:15:00+05:30" → "2024-01-15"
        open_ = round(float(row[1]), 2)
        high  = round(float(row[2]), 2)
        low   = round(float(row[3]), 2)
        close = round(float(row[4]), 2)
        vol   = int(row[5])
        candles.append({
            "time":   ts,
            "open":   open_,
            "high":   high,
            "low":    low,
            "close":  close,
            "volume": vol,
        })

    return candles


# ── RSI ───────────────────────────────────────────────────────────────────────
def calculate_rsi(prices: list[float], period: int = 14) -> list[float]:
    if len(prices) < period + 1:
        return []
    gains, losses = [], []
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    rsi_values = []
    for i in range(period, len(prices)):
        if avg_loss == 0:
            rsi_values.append(100.0)
        else:
            rs = avg_gain / avg_loss
            rsi_values.append(round(100 - (100 / (1 + rs)), 2))
        diff = prices[i] - prices[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(diff, 0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-diff, 0)) / period
    return rsi_values


# ── MACD ──────────────────────────────────────────────────────────────────────
def calculate_macd(prices: list[float], fast=12, slow=26, signal=9):
    def ema(data, p):
        k = 2 / (p + 1)
        e = [data[0]]
        for v in data[1:]:
            e.append(v * k + e[-1] * (1 - k))
        return e

    if len(prices) < slow:
        return [], [], []
    fe = ema(prices, fast)
    se = ema(prices, slow)
    macd = [round(f - s, 4) for f, s in zip(fe, se)]
    sig  = ema(macd, signal)
    hist = [round(m - s, 4) for m, s in zip(macd, sig)]
    return macd, sig, hist


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/candles/{ticker}")
def get_candles(ticker: str, period: str = "3mo", authorization: str = Header(...)):
    get_user_from_token(authorization)
    symbol = ticker.upper().strip()

    try:
        candles = fetch_candles_angel_one(symbol, period)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not candles:
        raise HTTPException(status_code=404, detail="No candle data returned")

    prices = [c["close"] for c in candles]
    dates  = [c["time"]  for c in candles]

    # Volume series with color
    volumes = [
        {
            "time":  c["time"],
            "value": c["volume"],
            "color": "#10b981" if c["close"] >= c["open"] else "#f43f5e",
        }
        for c in candles
    ]

    # RSI
    rsi_raw    = calculate_rsi(prices)
    rsi_offset = len(dates) - len(rsi_raw)
    rsi_data   = [{"time": dates[i + rsi_offset], "value": v} for i, v in enumerate(rsi_raw)]

    # MACD
    macd_line, signal_line, histogram = calculate_macd(prices)
    macd_offset = len(dates) - len(macd_line)
    macd_data   = [
        {
            "time":      dates[i + macd_offset],
            "macd":      macd_line[i],
            "signal":    round(signal_line[i], 4),
            "histogram": round(histogram[i], 4),
        }
        for i in range(len(macd_line))
    ]

    # Live price from cache/Angel One
    try:
        current_price = get_live_price(symbol)
    except Exception:
        current_price = prices[-1] if prices else 0

    # SMA / trend
    sma = simple_moving_average(prices, 7) if len(prices) >= 7 else []
    trend = "Upward" if len(sma) >= 2 and sma[-1] > sma[-2] else "Downward" if len(sma) >= 2 else "Neutral"

    return {
        "ticker":        symbol,
        "candles":       candles,
        "volumes":       volumes,
        "rsi":           rsi_data,
        "macd":          macd_data,
        "current_price": round(current_price, 2),
        "period":        period,
        "trend":         trend,
        "data_points":   len(candles),
    }


@router.get("/stock/{ticker}")
def analyze_stock(ticker: str, authorization: str = Header(...)):
    get_user_from_token(authorization)
    symbol = ticker.upper().strip()

    try:
        candles = fetch_candles_angel_one(symbol, "3mo")
        prices  = [c["close"] for c in candles]
        dates   = [c["time"]  for c in candles]

        if not prices:
            raise HTTPException(status_code=404, detail="No data found")

        sma        = simple_moving_average(prices, 7)
        ema        = exponential_moving_average(prices, 7)
        volatility = calculate_volatility(prices)
        sr         = sharpe_ratio(prices)
        seg_tree   = SegmentTree(prices)
        max_30     = seg_tree.get_max_in_range(max(0, len(prices) - 30), len(prices) - 1)
        trend      = "Upward" if len(sma) >= 2 and sma[-1] > sma[-2] else "Downward"

        return {
            "ticker":                 symbol,
            "prices":                 [round(p, 2) for p in prices],
            "dates":                  dates,
            "sma_7":                  sma,
            "ema_7":                  ema,
            "volatility":             volatility,
            "sharpe_ratio":           sr,
            "max_price_last_30_days": round(max_30, 2),
            "trend":                  trend,
            "total_data_points":      len(prices),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portfolio-optimize")
def optimize_portfolio(authorization: str = Header(...), risk_tolerance: str = "medium"):
    from app.database.db import transactions_collection

    email = get_user_from_token(authorization)
    txns  = list(transactions_collection.find({"email": email}, {"_id": 0}))

    if not txns:
        return {"message": "No transactions found. Add trades first.", "optimized_allocation": [], "total_budget": 0}

    # Compute open holdings from transactions (FIFO)
    holdings: dict = {}
    for t in sorted(txns, key=lambda x: x["date"]):
        sym   = t["symbol"]
        qty   = float(t["quantity"])
        price = float(t["price"])
        if sym not in holdings:
            holdings[sym] = {"quantity": 0.0, "total_cost": 0.0}
        if t["type"] == "buy":
            holdings[sym]["quantity"]   += qty
            holdings[sym]["total_cost"] += qty * price
        elif t["type"] == "sell" and holdings[sym]["quantity"] > 0:
            avg = holdings[sym]["total_cost"] / holdings[sym]["quantity"]
            holdings[sym]["quantity"]   -= qty
            holdings[sym]["total_cost"] -= avg * qty
            if holdings[sym]["quantity"] <= 0:
                holdings[sym] = {"quantity": 0.0, "total_cost": 0.0}

    open_holdings = {s: d for s, d in holdings.items() if d["quantity"] > 0}

    if not open_holdings:
        return {"message": "No open positions found.", "optimized_allocation": [], "total_budget": 0}

    # Total invested = current portfolio value (basis for optimizer budget)
    total_invested = sum(d["total_cost"] for d in open_holdings.values())

    stock_data = []
    for sym, data in open_holdings.items():
        try:
            candles = fetch_candles_angel_one(sym, "3mo")
            prices  = [c["close"] for c in candles]
            if not prices:
                continue
            vol     = calculate_volatility(prices)
            returns = (prices[-1] - prices[0]) / prices[0] if prices[0] else 0
            avg_cost = data["total_cost"] / data["quantity"]
            min_inv  = round(avg_cost * data["quantity"] * 0.1, 0)  # min 10% of current position
            stock_data.append({
                "ticker":          sym,
                "expected_return": round(returns, 4),
                "risk":            round(vol / 100, 4),
                "min_investment":  max(min_inv, 1000),
            })
            print(f"[optimizer] {sym}: return={returns:.2%}, risk={vol:.2f}%")
        except Exception as e:
            print(f"[optimizer] {sym} skipped: {e}")
            continue

    if not stock_data:
        return {"message": "Could not fetch price data for holdings.", "optimized_allocation": [], "total_budget": total_invested}

    optimized = portfolio_optimizer(stock_data, total_invested, risk_tolerance)
    return {
        "total_budget":         round(total_invested, 2),
        "optimized_allocation": optimized,
        "algorithm":            "Greedy Knapsack with Risk Tolerance",
    }


# ── /analyze endpoint — full quant analysis ───────────────────────────────────
@router.get("/analyze")
def analyze_full(
    stock:     str = "RELIANCE",
    timeframe: str = "swing",
    authorization: str = Header(...)
):
    get_user_from_token(authorization)
    symbol = stock.upper().strip()

    period_map = {"intraday": "1mo", "swing": "3mo", "long_term": "1y"}
    period     = period_map.get(timeframe, "3mo")

    try:
        candles = fetch_candles_angel_one(symbol, period)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not candles:
        raise HTTPException(status_code=404, detail=f"No data for '{symbol}'")

    closes  = [c["close"]  for c in candles]
    highs   = [c["high"]   for c in candles]
    lows    = [c["low"]    for c in candles]
    volumes = [c["volume"] for c in candles]
    dates   = [c["time"]   for c in candles]

    # ── Indicators ────────────────────────────────────────────────────────────
    import math

    def _ema(prices, p):
        if len(prices) < p: return []
        k = 2/(p+1); e = [sum(prices[:p])/p]
        for v in prices[p:]: e.append(v*k + e[-1]*(1-k))
        return [round(x,2) for x in e]

    def _rsi(prices, p=14):
        if len(prices) < p+1: return None
        g = [max(prices[i]-prices[i-1],0) for i in range(1,len(prices))]
        l = [max(prices[i-1]-prices[i],0) for i in range(1,len(prices))]
        ag = sum(g[:p])/p; al = sum(l[:p])/p
        for i in range(p, len(prices)-1):
            ag = (ag*(p-1)+g[i])/p; al = (al*(p-1)+l[i])/p
        return round(100-100/(1+ag/al),2) if al else 100.0

    def _vol_ann(prices):
        if len(prices)<2: return 0
        rets = [(prices[i]-prices[i-1])/prices[i-1] for i in range(1,len(prices))]
        m = sum(rets)/len(rets)
        std = math.sqrt(sum((r-m)**2 for r in rets)/len(rets))
        return round(std*math.sqrt(252)*100, 2)

    def _sharpe(prices, rf=0.065):
        if len(prices)<2: return 0
        rets = [(prices[i]-prices[i-1])/prices[i-1] for i in range(1,len(prices))]
        m = sum(rets)/len(rets); std = math.sqrt(sum((r-m)**2 for r in rets)/len(rets))
        if std==0: return 0
        return round((m*252-rf)/(std*math.sqrt(252)),2)

    def _mdd(prices):
        peak=prices[0]; mdd=0
        for p in prices:
            if p>peak: peak=p
            mdd=max(mdd,(peak-p)/peak)
        return round(mdd*100,2)

    sma50  = _ema(closes, 50)
    sma200 = _ema(closes, 200)
    ema20  = _ema(closes, 20)
    rsi_v  = _rsi(closes)
    vol_p  = _vol_ann(closes)
    sharpe = _sharpe(closes)
    mdd    = _mdd(closes)

    c = closes[-1]
    above50  = bool(sma50  and c > sma50[-1])
    above200 = bool(sma200 and c > sma200[-1])

    golden = False
    if len(sma50)>=15 and len(sma200)>=15:
        for i in range(-15,-1):
            if sma50[i-1]<sma200[i-1] and sma50[i]>=sma200[i]:
                golden=True; break

    if above50 and above200:
        ma_signal = "golden_cross" if golden else "bullish_above_200sma"
    elif above50:
        ma_signal = "bullish_above_50sma"
    else:
        ma_signal = "bearish_below_50sma"

    avg_vol10 = sum(volumes[-10:])/10 if len(volumes)>=10 else 0
    avg_vol30 = sum(volumes[-30:])/30 if len(volumes)>=30 else 0
    vol_expanding = avg_vol10 > avg_vol30*1.1

    # S/R
    recent_h = highs[-20:]; recent_l = lows[-20:]
    resistance = round(max(recent_h),2)
    support    = round(min(recent_l),2)

    # Trade setup
    risk   = c - support
    sl     = round(support*0.99, 2)
    t1     = round(c + risk, 2)
    t2     = round(c + risk*2, 2)
    t3     = round(resistance, 2)
    rr     = round((t1-c)/(c-sl),2) if c!=sl else 0

    # Fundamentals
    fund = {"name": symbol, "pe_ratio": None, "roe": None, "market_cap": None, "sector": "—"}
    try:
        info = yf.Ticker(f"{symbol}.NS").info or {}
        fund = {
            "name":       info.get("longName") or info.get("shortName") or symbol,
            "sector":     info.get("sector","—"),
            "pe_ratio":   round(info.get("trailingPE",0) or 0,2),
            "pb_ratio":   round(info.get("priceToBook",0) or 0,2),
            "roe":        round((info.get("returnOnEquity",0) or 0)*100,2),
            "debt_equity":round(info.get("debtToEquity",0) or 0,2),
            "market_cap": info.get("marketCap",0),
            "52w_high":   info.get("fiftyTwoWeekHigh"),
            "52w_low":    info.get("fiftyTwoWeekLow"),
            "beta":       round(info.get("beta",0) or 0,2),
            "dividend_yield": round((info.get("dividendYield",0) or 0)*100,2),
            "eps":        round(info.get("trailingEps",0) or 0,2),
            "revenue_growth": round((info.get("revenueGrowth",0) or 0)*100,2),
            "profit_margin":  round((info.get("profitMargins",0) or 0)*100,2),
        }
    except Exception: pass

    # Scoring
    tech_pts = 0
    if "golden" in ma_signal or "200" in ma_signal: tech_pts += 20
    elif "50" in ma_signal: tech_pts += 12
    if rsi_v:
        if 40<=rsi_v<=60: tech_pts+=15
        elif 30<=rsi_v<40: tech_pts+=18
        elif 60<rsi_v<=70: tech_pts+=10
        elif rsi_v<30: tech_pts+=12
        else: tech_pts+=3
    if vol_expanding: tech_pts+=10
    sr_val = sharpe or 0
    if sr_val>1.5: tech_pts+=10
    elif sr_val>0.5: tech_pts+=6

    fund_pts = 0
    pe = fund.get("pe_ratio") or 0
    roe= fund.get("roe") or 0
    de = fund.get("debt_equity") or 999
    if 0<pe<15: fund_pts+=15
    elif 0<pe<25: fund_pts+=10
    elif 0<pe<40: fund_pts+=5
    if roe>20: fund_pts+=12
    elif roe>12: fund_pts+=7
    if de<0.5: fund_pts+=8
    elif de<1: fund_pts+=4

    score = min(100, tech_pts + fund_pts)

    if score>=70:   verdict="🟢 Strongly Bullish"
    elif score>=55: verdict="🟩 Bullish"
    elif score>=45: verdict="🟡 Neutral"
    elif score>=30: verdict="🟥 Bearish"
    else:           verdict="🔴 Strongly Bearish"

    rsi_sig = ("overbought" if (rsi_v or 50)>=70 else "oversold" if (rsi_v or 50)<=30 else "bullish" if (rsi_v or 50)>=55 else "neutral")

    inv_view = (f"ROE {roe}% with PE {pe} — good fundamentals for accumulation." if roe>15 and 0<pe<30 else
                f"Expensive at PE {pe}. Wait for better entry." if pe>40 else
                "Mixed fundamentals. Review before investing.")

    trd_view = ("Golden cross confirmed — momentum buy on dips." if golden else
                "Uptrend intact above 50/200 EMA — trail stops." if above200 else
                "RSI oversold — watch for reversal candle." if rsi_v and rsi_v<35 else
                "Below key EMAs — avoid fresh longs until reclaim.")

    risks = []
    if (de or 0)>2: risks.append(f"High leverage: D/E {de}x")
    if (pe or 0)>50: risks.append(f"Expensive valuation: PE {pe}x")
    if vol_p>40: risks.append(f"High volatility: {vol_p}% annualised")
    if mdd>30: risks.append(f"Max drawdown {mdd}% historically")
    if not risks: risks.append("No major red flags. Standard market risk applies.")

    # Build price_history for chart
    def pad(arr, total):
        return [None]*(total-len(arr)) + arr

    return {
        "stock":     symbol,
        "name":      fund.get("name", symbol),
        "timeframe": timeframe,
        "fundamentals": fund,
        "technicals": {
            "current_price": round(c,2),
            "trend":         ma_signal,
            "ma_signal":     ma_signal,
            "sma_50":        sma50[-1]  if sma50  else None,
            "sma_200":       sma200[-1] if sma200 else None,
            "ema_20":        ema20[-1]  if ema20  else None,
            "rsi_current":   rsi_v,
            "rsi_signal":    rsi_sig,
            "macd":          {"current": {"crossover": "bullish" if (closes[-1]>closes[-2]) else "bearish"}},
            "bollinger":     {"signal": "—"},
            "support_resistance": {
                "nearest_support":    support,
                "nearest_resistance": resistance,
                "pct_to_resistance":  round((resistance-c)/c*100,2),
                "pct_to_support":     round((c-support)/c*100,2),
            },
            "volatility":   vol_p,
            "sharpe_ratio": sharpe,
            "max_drawdown": mdd,
            "volume":       {"signal": "strong_bullish" if vol_expanding and closes[-1]>closes[-2] else "neutral", "vol_ratio": round(avg_vol10/avg_vol30,2) if avg_vol30 else 1},
            "price_history": {
                "dates":   dates,
                "closes":  [round(p,2) for p in closes],
                "sma_50":  pad(sma50,  len(dates)),
                "sma_200": pad(sma200, len(dates)),
                "ema_20":  pad(ema20,  len(dates)),
            }
        },
        "smart_money":   {"institutional_holders": []},
        "trade_setup":   {"entry": round(c,2), "stop_loss": sl, "targets": [t1,t2,t3], "risk_reward": f"1:{rr}", "risk_pct": round((c-sl)/c*100,2)},
        "risks":         risks,
        "investor_view": inv_view,
        "trader_view":   trd_view,
        "verdict":       verdict,
        "confidence":    score,
        "scoring":       {"total": score, "technical_total": tech_pts, "fundamental_total": fund_pts, "smart_money_total": 10},
    }