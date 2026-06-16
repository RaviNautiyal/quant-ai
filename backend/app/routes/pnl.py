"""
app/routes/pnl.py
─────────────────
Matches YOUR database structure:
- Uses named collection exports from app.database.db (transactions_collection etc.)
- Uses email as user identifier (same pattern as your alerts.py)

Add to app/main.py:
    from app.routes import pnl
    app.include_router(pnl.router, prefix="/pnl", tags=["pnl"])
"""

from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from app.database.db import transactions_collection
from app.utils.auth import decode_token
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from collections import defaultdict
import io, csv

router = APIRouter()

# ── Ticker field resolver ─────────────────────────────────────────────────────
# Handles any field name your transactions collection uses:
# "ticker", "symbol", "stock_symbol", "tradingsymbol", "instrument"

def _t(txn: dict) -> str:
    """Extract and normalise ticker from a transaction document regardless of field name."""
    raw = (
        txn.get("ticker")
        or txn.get("symbol")
        or txn.get("stock_symbol")
        or txn.get("tradingsymbol")
        or txn.get("instrument")
        or txn.get("scrip")
        or ""
    )
    return str(raw).upper().strip().replace(" ", "")

# ── Auth ──────────────────────────────────────────────────────────────────────

def get_user_from_token(authorization: str) -> str:
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email

# ── Price helpers ──────────────────────────────────────────────────────────────

def _normalize(ticker: str) -> str:
    t = ticker.strip().upper().replace(" ", "")
    if "." in t or t.startswith("^"):
        return t
    return t + ".NS"

def _fetch_prices_bulk(tickers: list) -> dict:
    """Fetch latest close for multiple tickers. Falls back one-by-one on error."""
    if not tickers:
        return {}
    normalized = {t: _normalize(t) for t in tickers}
    out = {}

    for orig, norm in normalized.items():
        try:
            df = yf.download(norm, period="2d", auto_adjust=True, progress=False)
            if df.empty:
                continue
            close = df["Close"]
            if isinstance(close, pd.DataFrame):
                close = close.iloc[:, 0]
            v = close.dropna()
            if not v.empty:
                out[orig] = float(v.iloc[-1])
        except Exception:
            pass
    return out

def _tax_estimate(pnl: float, holding_days: int):
    if pnl <= 0:
        return 0.0, 0.0
    if holding_days < 365:
        return round(pnl * 0.20, 2), 0.0
    taxable = max(0.0, pnl - 100000)
    return 0.0, round(taxable * 0.125, 2)

# ── FIFO engine ───────────────────────────────────────────────────────────────

def _compute_fifo(txns: list, prices: dict) -> dict:
    sorted_txns = sorted(txns, key=lambda x: x.get("date", x.get("created_at", x.get("timestamp", ""))))
    queues: dict = defaultdict(list)
    realised = 0.0

    for t in sorted_txns:
        ticker = (_t(t))
        qty    = float(t.get("quantity", t.get("qty", 0)))
        price  = float(t.get("price", 0))
        action = t.get("action", t.get("type", t.get("transaction_type", "BUY"))).upper()
        raw_date = t.get("date", t.get("created_at", t.get("timestamp", "")))
        try:
            date = pd.to_datetime(raw_date).to_pydatetime()
        except Exception:
            date = datetime.utcnow()

        if "BUY" in action or action == "B":
            queues[ticker].append({"price": price, "qty": qty, "date": date})
        elif "SELL" in action or action == "S":
            remaining = qty
            while remaining > 0 and queues[ticker]:
                lot      = queues[ticker][0]
                sell_qty = min(remaining, lot["qty"])
                realised += (price - lot["price"]) * sell_qty
                lot["qty"]  -= sell_qty
                remaining   -= sell_qty
                if lot["qty"] <= 0:
                    queues[ticker].pop(0)

    open_stocks = {}
    for ticker, lots in queues.items():
        total_qty = sum(l["qty"] for l in lots)
        if total_qty <= 0:
            continue
        avg_cost     = sum(l["price"] * l["qty"] for l in lots) / total_qty
        invested     = avg_cost * total_qty
        cur_price    = prices.get(ticker)
        cur_value    = (cur_price or avg_cost) * total_qty
        pnl          = cur_value - invested
        pnl_pct      = (pnl / invested * 100) if invested else 0
        oldest       = min(l["date"] for l in lots)
        holding_days = (datetime.utcnow() - oldest).days
        stcg, ltcg   = _tax_estimate(max(pnl, 0), holding_days)
        open_stocks[ticker] = {
            "ticker":        ticker,
            "name":          ticker,
            "invested":      round(invested, 2),
            "current_value": round(cur_value, 2),
            "pnl":           round(pnl, 2),
            "pnl_pct":       round(pnl_pct, 2),
            "holding_days":  holding_days,
            "tax_category":  "LTCG" if holding_days >= 365 else "STCG",
            "stcg_tax":      stcg,
            "ltcg_tax":      ltcg,
        }

    return {"realised": round(realised, 2), "open_stocks": open_stocks}

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/summary")
def pnl_summary(authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    txns  = list(transactions_collection.find({"email": email}, {"_id": 0}))
    if not txns:
        return {"total_invested":0,"current_value":0,"total_pnl":0,"total_pnl_pct":0,
                "realised_pnl":0,"unrealised_pnl":0,"stcg_tax":0,"ltcg_tax":0,"total_tax":0,
                "best_performer":"","worst_performer":""}

    tickers = list({(_t(t)) for t in txns if _t(t)})
    prices  = _fetch_prices_bulk(tickers)
    result  = _compute_fifo(txns, prices)
    stocks  = result["open_stocks"]

    unrealised     = sum(s["pnl"] for s in stocks.values())
    total_invested = sum(s["invested"] for s in stocks.values())
    current_value  = sum(s["current_value"] for s in stocks.values())
    total_pnl      = result["realised"] + unrealised
    total_pnl_pct  = (total_pnl / total_invested * 100) if total_invested else 0
    stcg_tax       = sum(s["stcg_tax"] for s in stocks.values())
    ltcg_tax       = sum(s["ltcg_tax"] for s in stocks.values())
    best  = max(stocks.values(), key=lambda s: s["pnl_pct"]).get("ticker","") if stocks else ""
    worst = min(stocks.values(), key=lambda s: s["pnl_pct"]).get("ticker","") if stocks else ""

    return {
        "total_invested": round(total_invested,2), "current_value": round(current_value,2),
        "total_pnl": round(total_pnl,2), "total_pnl_pct": round(total_pnl_pct,2),
        "realised_pnl": round(result["realised"],2), "unrealised_pnl": round(unrealised,2),
        "stcg_tax": round(stcg_tax,2), "ltcg_tax": round(ltcg_tax,2),
        "total_tax": round(stcg_tax+ltcg_tax,2),
        "best_performer": best, "worst_performer": worst,
    }


@router.get("/stocks")
def pnl_stocks(authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    txns  = list(transactions_collection.find({"email": email}, {"_id": 0}))
    if not txns:
        return []
    tickers = list({(_t(t)) for t in txns if _t(t)})
    prices  = _fetch_prices_bulk(tickers)
    result  = _compute_fifo(txns, prices)
    return sorted(result["open_stocks"].values(), key=lambda s: s["pnl"], reverse=True)


@router.get("/daily")
def pnl_daily(authorization: str = Header(...)):
    email = get_user_from_token(authorization)
    txns  = list(transactions_collection.find({"email": email}, {"_id": 0}))
    if not txns:
        return []

    tickers = list({(_t(t)) for t in txns if _t(t)})
    end, start = datetime.utcnow(), datetime.utcnow() - timedelta(days=90)

    hist: dict = {}
    for ticker in tickers:
        try:
            df = yf.download(_normalize(ticker), start=start, end=end, auto_adjust=True, progress=False)
            if not df.empty:
                col = df["Close"]
                if isinstance(col, pd.DataFrame): col = col.iloc[:,0]
                hist[ticker] = col
        except Exception:
            pass

    if not hist:
        return []

    all_dates = sorted(set().union(*[s.index for s in hist.values()]))
    out, cumulative = [], 0.0

    for i, date in enumerate(all_dates):
        if i == 0:
            out.append({"date": str(date.date()), "pnl": 0.0, "cumulative": 0.0})
            continue
        prev = all_dates[i-1]
        daily_pnl = 0.0
        for ticker, series in hist.items():
            if date not in series.index or prev not in series.index:
                continue
            held = 0.0
            for t in txns:
                if (_t(t)) != ticker:
                    continue
                try:
                    tdate = pd.to_datetime(t.get("date", t.get("created_at", t.get("timestamp","")))).to_pydatetime()
                except Exception:
                    continue
                if tdate.date() > date.date():
                    continue
                qty    = float(t.get("quantity", t.get("qty", 0)))
                action = t.get("action", t.get("type", t.get("transaction_type","BUY"))).upper()
                if "BUY" in action or action == "B":
                    held += qty
                elif "SELL" in action or action == "S":
                    held -= qty
            if held > 0:
                try:
                    daily_pnl += (float(series[date]) - float(series[prev])) * held
                except Exception:
                    pass
        cumulative += daily_pnl
        out.append({"date": str(date.date()), "pnl": round(daily_pnl,2), "cumulative": round(cumulative,2)})

    return out


@router.get("/monthly")
def pnl_monthly(authorization: str = Header(...)):
    daily = pnl_daily(authorization)
    if not daily:
        return []
    monthly: dict = defaultdict(float)
    for row in daily:
        monthly[row["date"][:7]] += row["pnl"]
    return [{"month": k, "pnl": round(v,2)} for k,v in sorted(monthly.items())]


@router.get("/yearly")
def pnl_yearly(authorization: str = Header(...)):
    monthly = pnl_monthly(authorization)
    if not monthly:
        return []
    yearly: dict = defaultdict(float)
    for row in monthly:
        yearly[row["month"][:4]] += row["pnl"]
    return [{"year": k, "pnl": round(v,2)} for k,v in sorted(yearly.items())]


@router.post("/import-csv")
async def import_csv(file: UploadFile = File(...), authorization: str = Header(...)):
    email   = get_user_from_token(authorization)
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    def col(row: dict, *keys: str) -> str:
        for k in keys:
            for rk, rv in row.items():
                if rk.lower().strip() == k.lower():
                    return str(rv).strip()
        return ""

    imported, skipped, docs = 0, 0, []
    for row in reader:
        try:
            ticker = col(row,"symbol","scrip","ticker","stock","instrument")
            action = col(row,"trade_type","ordertype","type","action","transaction_type","side")
            qty    = col(row,"quantity","qty","shares","filled_qty")
            price  = col(row,"price","trade_price","avg_price","average_price")
            date   = col(row,"trade_date","time","date","order_execution_time","timestamp")

            if not ticker or not qty or not price:
                skipped += 1; continue

            action_up = action.upper()
            if "BUY" in action_up or action_up == "B":
                action_clean = "BUY"
            elif "SELL" in action_up or action_up == "S":
                action_clean = "SELL"
            else:
                skipped += 1; continue

            try:
                parsed_date = pd.to_datetime(date).isoformat()
            except Exception:
                parsed_date = datetime.utcnow().isoformat()

            docs.append({
                "email": email, "ticker": ticker.upper().replace(" ",""),
                "action": action_clean,
                "quantity": float(str(qty).replace(",","")),
                "price":    float(str(price).replace(",","")),
                "date": parsed_date, "source": "csv_import",
            })
            imported += 1
        except Exception:
            skipped += 1

    if docs:
        transactions_collection.insert_many(docs)

    return {
        "imported": imported, "skipped": skipped,
        "message": f"Imported {imported} transactions" + (f" ({skipped} skipped)" if skipped else ""),
    }