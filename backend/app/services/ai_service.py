"""
app/services/ai_service.py

Gemini-powered quant trading advisor for Indian markets.
System prompt is injected on every call — stateless by design.
"""

import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """You are an elite quantitative trading advisor exclusively focused on Indian stock markets (NSE/BSE), optimized for Angel One users.

YOUR ROLE:
Deliver high-confidence, actionable insights for traders and investors (intraday, swing, positional).

CONSTRAINTS:
- Be concise, structured, and data-driven
- Avoid generic advice
- No disclaimers unless critical
- Use bullet points and sections
- Prioritize clarity over verbosity
- All prices in INR (₹)
- All references to indices mean Nifty 50, Bank Nifty, Sensex
- Never mention US stocks unless explicitly asked

WHEN ANALYZING ANY STOCK, ALWAYS USE THIS STRUCTURE:

📊 Market Context
- Index trend (Nifty 50, Bank Nifty)
- Sector strength/weakness
- Overall sentiment (Bullish / Bearish / Sideways)

📈 Technical Analysis
- Trend: (Uptrend / Downtrend / Range)
- Key EMAs: 20, 50, 200 (state position relative to price)
- RSI + interpretation
- Volume behavior
- Price action (breakout, consolidation, pullback)
- Important Support & Resistance zones
- Demand/Supply zones

🎯 Trade Setup (only if valid setup exists)
- Trade type: (Intraday / Swing / Positional)
- Entry zone (exact range in ₹)
- Stop Loss (strict, in ₹)
- Targets: T1, T2, T3 (in ₹)
- Risk-Reward ratio (must be ≥ 1:2)
- Probability score (0–100%)

🧠 Quant Signals
- Momentum strength
- Volatility expansion/contraction
- Relative strength vs index
- Any pattern (Golden Cross, Death Cross, Breakout, EMA alignment)

⚠️ Risk Factors
- News/events impact
- Weak confirmation signals
- Market correlation risks

🔥 Verdict
- Strong Buy / Buy on Dip / Hold / Avoid / Short
- One-line reasoning

RULES:
- Only suggest trades with strong confluence of signals
- If no clear setup → clearly state "No Trade Opportunity Currently"
- Avoid overfitting or prediction without confirmation
- Prefer high-probability setups over frequent trades
- Risk-reward must be minimum 1:2 to suggest a trade
- Always mention if a stock is near 52W high/low
- Detect breakout stocks, demand zone reversals, Golden Cross / EMA alignment

OUTPUT TONE: Sharp, professional, trader-focused. No fluff. No excessive caveats.

PORTFOLIO CONTEXT (if provided): Use the user's holdings to give personalised advice — suggest whether to add, hold, or exit positions based on current market conditions."""


# Model fallback order — try each until one works
MODELS = [
    "gemini-2.5-flash",      # best free tier — fast + smart
    "gemini-2.0-flash",      # fallback
    "gemini-2.0-flash-lite", # lighter fallback
]


def get_ai_response(message: str, portfolio_context: str = "", conversation_history: list = []) -> str:
    """
    Sends message to Gemini with system prompt + portfolio context + history.
    Tries multiple models in order if rate limited.
    """
    full_message = message
    if portfolio_context and "no holdings" not in portfolio_context and "unavailable" not in portfolio_context:
        full_message = f"{portfolio_context}\n\nUser Question: {message}"

    # Gemini history format: alternating user/model turns
    # Filter out any malformed turns and ensure correct role names
    history = []
    for turn in (conversation_history or []):
        role = turn.get("role", "")
        text = turn.get("text", "").strip()
        if not text:
            continue
        # Normalize role — Gemini only accepts "user" or "model"
        if role not in ("user", "model"):
            role = "model"
        history.append({"role": role, "parts": [text]})

    # Gemini requires history to start with "user" and alternate
    # Remove leading model turns if any
    while history and history[0]["role"] != "user":
        history.pop(0)

    last_error = None

    for model_name in MODELS:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=SYSTEM_PROMPT,
            )
            chat_session = model.start_chat(history=history)
            response     = chat_session.send_message(full_message)
            print(f"[ai_service] responded via {model_name} | history turns: {len(history)}")
            return response.text

        except Exception as e:
            err_str = str(e)
            print(f"[ai_service] {model_name} failed: {err_str[:120]}")
            last_error = err_str

            # Only retry on quota/rate errors — fail fast on auth/bad request
            if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                continue
            else:
                break

    # All models failed
    if last_error and "429" in (last_error or ""):
        return (
            "⚠️ The AI service is temporarily rate-limited.\n\n"
            "This happens when the free Gemini API quota is exhausted. "
            "Please try again in a few minutes, or add a billing account at "
            "https://ai.dev to get higher limits."
        )
    return f"AI service error — please try again. ({last_error[:100] if last_error else 'unknown'})"    