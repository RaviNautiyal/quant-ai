from contextlib import asynccontextmanager
from app.services.alert_scheduler import start_scheduler, stop_scheduler
import logging
import requests

# Suppress noisy SmartAPI internal logs
logging.getLogger('SmartApi').setLevel(logging.WARNING)
logging.getLogger('smartConnect').setLevel(logging.WARNING)
import yfinance as yf
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Routers ───────────────────────────────────────────────────────────────────
from app.routes.transactions  import router as transactions_router
from app.routes.screener      import router as screener_router
from app.routes.payments      import router as payments_router
from app.routes.market        import router as market_router
from app.routes.comparison    import router as comparison_router
from app.routes.alerts        import router as alerts_router
from app.routes.watchlist     import router as watchlist_router
from app.routes.analysis      import router as analysis_router
from app.routes.news          import router as news_router
from app.routes.portfolio     import router as portfolio_router
from app.routes.ai            import router as ai_router
from app.routes.auth          import router as auth_router
from app.routes.market_status import router as market_status_router
from app.routes.ws            import router as ws_router
from app.routes.push          import router as push_router
from app.routes import pnl
from app.routes import charts
from app.routes import push

# ── App ───────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app):
    start_scheduler()   # starts the 30s alert checking loop
    yield
    stop_scheduler()    # clean shutdown
app = FastAPI()
# Before
app = FastAPI()

# After
app = FastAPI(lifespan=lifespan)
# ── CORS — must be before routers ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "https://*.vercel.app",
         "https://ai-investement-agent-wf36.vercel.app" ,
         "https://quant-ai-sooty.vercel.app",
         "https://quant-g49n0iaji-ravi-nautiyals-projects.vercel.app"# covers all Vercel preview URLs too
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],

)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(push_router, prefix="/push")
app.include_router(ws_router)
app.include_router(market_status_router, prefix="/api")
app.include_router(auth_router,          prefix="/auth")
app.include_router(transactions_router,  prefix="/transactions", tags=["Transactions"])
app.include_router(portfolio_router,     prefix="/portfolio")
app.include_router(watchlist_router,     prefix="/watchlist")
app.include_router(market_router,        prefix="/market")
app.include_router(screener_router,      prefix="/screener")
app.include_router(payments_router,      prefix="/payments")
app.include_router(comparison_router,    prefix="/comparison")
app.include_router(alerts_router,        prefix="/alerts")
app.include_router(analysis_router,      prefix="/analysis")
app.include_router(news_router,          prefix="/news")
app.include_router(ai_router,            prefix="/ai")
app.include_router(pnl.router, prefix="/pnl", tags=["pnl"])
app.include_router(charts.router, prefix="/charts", tags=["charts"])
app.include_router(push.router, prefix="/push", tags=["push"])

# ── Misc ──────────────────────────────────────────────────────────────────────
@app.get("/ping")
def ping():
    return {"status": "ok"}
@app.get("/")
def home():
    return {"message": "Backend is running"}

@app.get("/search/{query}")
def search_stock(query: str):
    try:
        url = f"https://financialmodelingprep.com/stable/search-name?query={query}&apikey=W4rqQ4jJTwJByzC0JfJXDaQl8bXN8hBp"
        response = requests.get(url)
        data = response.json()
        if not isinstance(data, list):
            return []
        return [
            {"name": item.get("name", "Unknown"), "ticker": item.get("symbol", "")}
            for item in data if isinstance(item, dict)
        ]
    except Exception as e:
        return {"error": str(e)}

# Map common Indian names/aliases to yfinance symbols
TICKER_ALIASES = {
    "NIFTY":      "^NSEI",
    "NIFTY50":    "^NSEI",
    "NIFTY 50":   "^NSEI",
    "SENSEX":     "^BSESN",
    "BANKNIFTY":  "^NSEBANK",
    "NIFTYBANK":  "^NSEBANK",
    "GOLD":       "GC=F",
    "SILVER":     "SI=F",
    "CRUDEOIL":   "CL=F",
    "USDINR":     "USDINR=X",
}

@app.get("/stock/{ticker}")
def get_stock(ticker: str):
    # Resolve alias (e.g. NIFTY → ^NSEI)
    yf_symbol = TICKER_ALIASES.get(ticker.upper(), ticker)
    # For NSE stocks not in alias map, try .NS suffix if no ^ prefix
    if not yf_symbol.startswith("^") and "=" not in yf_symbol and "." not in yf_symbol:
        yf_symbol = f"{yf_symbol}.NS"

    try:
        stock = yf.Ticker(yf_symbol)
        data  = stock.history(period="1mo")
        if data.empty:
            # Try without .NS suffix as fallback
            stock = yf.Ticker(ticker)
            data  = stock.history(period="1mo")
        if data.empty:
            return {"error": f"No data found for {ticker}", "ticker": ticker, "close_prices": [], "dates": []}
        info = stock.info
        return {
            "ticker":       ticker,
            "yf_symbol":    yf_symbol,
            "close_prices": data["Close"].tolist(),
            "dates":        data.index.strftime("%Y-%m-%d").tolist(),
            "name":         info.get("longName") or info.get("shortName") or ticker,
            "price":        info.get("currentPrice") or info.get("regularMarketPrice") or (data["Close"].tolist()[-1] if not data.empty else 0),
            "change":       round(((data["Close"].tolist()[-1] - data["Close"].tolist()[-2]) / data["Close"].tolist()[-2]) * 100, 2) if len(data) >= 2 else 0,
            "high":         info.get("dayHigh") or data["High"].tolist()[-1],
            "low":          info.get("dayLow")  or data["Low"].tolist()[-1],
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker, "close_prices": [], "dates": []}