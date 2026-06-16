from fastapi import APIRouter, Header, HTTPException
from app.services.news_service import get_stock_news
from app.services.ai_service import get_ai_response
from app.utils.auth import decode_token
from app.services.instruments import get_symbol_token
from pydantic import BaseModel

router = APIRouter()

class NewsAnalysisRequest(BaseModel):
    ticker: str
    company_name: str = ""

def get_user_from_token(authorization: str):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email

def resolve_company_name(ticker: str, provided_name: str) -> str:
    if provided_name.strip():
        return provided_name.strip()
    try:
        import yfinance as yf
        info = yf.Ticker(f"{ticker}.NS").info
        return info.get("longName") or info.get("shortName") or ticker
    except Exception:
        return ticker

NEWS_SYSTEM_PROMPT = """You are a high-performance financial news analyst for Indian stock markets (NSE/BSE).
Your job: Convert raw news into actionable trading intelligence.
Do NOT summarize news like a journalist. Instead, interpret its MARKET IMPACT.

Constraints:
- Be concise, sharp, and structured
- No generic explanations
- No long paragraphs
- Focus only on actionable insights
- Avoid repeating the news text
- All price references in ₹ (INR)
- All references to indices mean Nifty 50, Bank Nifty, Sensex

For every news input, follow this structure EXACTLY:

📰 News Classification
- Type: (Earnings / Order Win / Govt Policy / Block Deal / Management / Macro / Sector / Rumor)
- Impact Horizon: (Intraday / Short-term / Medium-term / Long-term)

⚡ Impact Analysis
- Bullish / Bearish / Neutral
- Strength: (Low / Moderate / High / Extreme)
- Why it matters (1–2 lines max)

🎯 Market Reaction Expectation
- Gap Up / Gap Down / Volatile / No major move
- Expected behavior: (Breakout / Pullback / Consolidation / Trend continuation)

📊 Trading Insight
- Trade Bias: (Buy / Sell / Wait / Avoid)
- Ideal zone: (Dip / Breakout / Range)
- Key trigger: (what confirms the move)

🧠 Smart Money Signals
- Institutional interest? (Yes / No / Unknown)
- Sector sympathy effect (which stocks benefit or fall)

⚠️ Risk Factors
- Already priced in?
- Fake/temporary news?
- Contradicting signals?

🔥 Final Verdict
- One-line actionable call

Rules:
- If impact is weak → clearly say "No Trade Edge"
- Do NOT overhype news
- Prioritize reaction over information
- Think like a trader, not a reporter

Tone: Crisp, decisive, no fluff."""


@router.post("/analyze")
def analyze_news(req: NewsAnalysisRequest, authorization: str = Header(...)):
    get_user_from_token(authorization)

    ticker       = req.ticker.upper().strip()
    company_name = resolve_company_name(ticker, req.company_name)
    articles     = get_stock_news(ticker, company_name)

    if not articles:
        return {
            "articles":     [],
            "analysis":     "No recent news found for this stock on NSE/BSE.",
            "company_name": company_name,
        }

    # Build structured news context
    news_lines = []
    for i, a in enumerate(articles[:8], 1):   # cap at 8 articles
        line = f"{i}. {a['title']}"
        if a.get("description"):
            line += f"\n   {a['description']}"
        line += f"\n   Source: {a['source']} | {a.get('publishedAt', '')[:10]}"
        news_lines.append(line)

    news_context = "\n\n".join(news_lines)

    prompt = f"""Stock: {company_name} ({ticker}) — NSE/BSE

News:
{news_context}

Analyze the trading impact."""

    analysis = get_ai_response(
        message=prompt,
        portfolio_context="",
        conversation_history=[],
    )

    return {
        "articles":     articles,
        "analysis":     analysis,
        "company_name": company_name,
        "ticker":       ticker,
    }


@router.post("/fetch")
def fetch_news(req: NewsAnalysisRequest, authorization: str = Header(...)):
    get_user_from_token(authorization)
    ticker       = req.ticker.upper().strip()
    company_name = resolve_company_name(ticker, req.company_name)
    articles     = get_stock_news(ticker, company_name)
    return {"articles": articles, "company_name": company_name}