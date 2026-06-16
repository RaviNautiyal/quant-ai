"""
app/services/instruments.py

Symbol → token lookup with hardcoded cache for common NSE stocks and indices.
Falls back to searchScrip API only for unknown symbols.
Hardcoding avoids rate limit hits on startup.
"""

# ── Hardcoded token map ───────────────────────────────────────────────────────
# Format: "SYMBOL": (token, exchange, tradingsymbol)
KNOWN_TOKENS: dict[str, tuple[str, str, str]] = {

    # ── Nifty 50 stocks ───────────────────────────────────────────────────────
    "RELIANCE":   ("2885",   "NSE", "RELIANCE-EQ"),
    "TCS":        ("11536",  "NSE", "TCS-EQ"),
    "HDFCBANK":   ("1333",   "NSE", "HDFCBANK-EQ"),
    "INFY":       ("1594",   "NSE", "INFY-EQ"),
    "ICICIBANK":  ("4963",   "NSE", "ICICIBANK-EQ"),
    "SBIN":       ("3045",   "NSE", "SBIN-EQ"),
    "BAJFINANCE": ("317",    "NSE", "BAJFINANCE-EQ"),
    "WIPRO":      ("3787",   "NSE", "WIPRO-EQ"),
    "AXISBANK":   ("5900",   "NSE", "AXISBANK-EQ"),
    "KOTAKBANK":  ("1922",   "NSE", "KOTAKBANK-EQ"),
    "ADANIENT":   ("25",     "NSE", "ADANIENT-EQ"),
    "ADANIPORTS": ("15083",  "NSE", "ADANIPORTS-EQ"),
    "HINDUNILVR": ("1394",   "NSE", "HINDUNILVR-EQ"),
    "MARUTI":     ("10999",  "NSE", "MARUTI-EQ"),
    "TATAMOTORS": ("3456",   "NSE", "TATAMOTORS-EQ"),
    "TATASTEEL":  ("3499",   "NSE", "TATASTEEL-EQ"),
    "SUNPHARMA":  ("3351",   "NSE", "SUNPHARMA-EQ"),
    "BHARTIARTL": ("10604",  "NSE", "BHARTIARTL-EQ"),
    "ITC":        ("1660",   "NSE", "ITC-EQ"),
    "LT":         ("11483",  "NSE", "LT-EQ"),
    "HCLTECH":    ("7229",   "NSE", "HCLTECH-EQ"),
    "ASIANPAINT": ("236",    "NSE", "ASIANPAINT-EQ"),
    "ULTRACEMCO": ("11532",  "NSE", "ULTRACEMCO-EQ"),
    "NTPC":       ("11630",  "NSE", "NTPC-EQ"),
    "POWERGRID":  ("14977",  "NSE", "POWERGRID-EQ"),
    "ONGC":       ("2475",   "NSE", "ONGC-EQ"),
    "COALINDIA":  ("20374",  "NSE", "COALINDIA-EQ"),
    "JSWSTEEL":   ("11723",  "NSE", "JSWSTEEL-EQ"),
    "GRASIM":     ("1232",   "NSE", "GRASIM-EQ"),
    "TECHM":      ("13538",  "NSE", "TECHM-EQ"),
    "DRREDDY":    ("881",    "NSE", "DRREDDY-EQ"),
    "DIVISLAB":   ("10940",  "NSE", "DIVISLAB-EQ"),
    "CIPLA":      ("694",    "NSE", "CIPLA-EQ"),
    "EICHERMOT":  ("910",    "NSE", "EICHERMOT-EQ"),
    "BAJAJFINSV": ("16675",  "NSE", "BAJAJFINSV-EQ"),
    "TITAN":      ("3506",   "NSE", "TITAN-EQ"),
    "NESTLEIND":  ("17963",  "NSE", "NESTLEIND-EQ"),
    "APOLLOHOSP": ("157",    "NSE", "APOLLOHOSP-EQ"),
    "TATACONSUM": ("3432",   "NSE", "TATACONSUM-EQ"),
    "HEROMOTOCO": ("1348",   "NSE", "HEROMOTOCO-EQ"),
    "BPCL":       ("526",    "NSE", "BPCL-EQ"),
    "INDUSINDBK": ("5258",   "NSE", "INDUSINDBK-EQ"),
    "MM":         ("2031",   "NSE", "M&M-EQ"),

    # ── Indices ───────────────────────────────────────────────────────────────
    # Angel One uses special token IDs for indices — not tradable but LTP works
    "NIFTY":      ("99926000", "NSE", "Nifty 50"),
    "NIFTY50":    ("99926000", "NSE", "Nifty 50"),
    "BANKNIFTY":  ("99926009", "NSE", "Nifty Bank"),
    "NIFTYBANK":  ("99926009", "NSE", "Nifty Bank"),
    "FINNIFTY":   ("99926037", "NSE", "Nifty Fin Service"),
    "MIDCPNIFTY": ("99926074", "NSE", "Nifty Midcap Select"),
    "SENSEX":     ("99919000", "BSE", "Sensex"),
}

# ── Runtime cache for API-looked-up symbols ───────────────────────────────────
_token_cache: dict[str, tuple[str, str, str]] = {}


def get_symbol_token(symbol: str) -> tuple[str | None, str | None, str | None]:
    """
    Returns (token, exchange, tradingsymbol) for a symbol.
    Checks hardcoded map first, then runtime cache, then searchScrip API.
    """
    symbol = symbol.upper().strip()

    # 1. Hardcoded — instant, no rate limit risk
    if symbol in KNOWN_TOKENS:
        return KNOWN_TOKENS[symbol]

    # 2. Runtime cache
    if symbol in _token_cache:
        return _token_cache[symbol]

    # 3. API fallback for unknown symbols
    try:
        import time
        time.sleep(0.3)  # stay under rate limit

        from app.services.angel_one import search_scrip
        resp = search_scrip("NSE", symbol)
        print(f"[searchScrip] {symbol} → {str(resp)[:120]}")

        if resp.get("status") and resp.get("data"):
            for item in resp["data"]:
                ts = item.get("tradingsymbol", "").upper()
                if ts == f"{symbol}-EQ":
                    result = (item["symboltoken"], "NSE", ts)
                    _token_cache[symbol] = result
                    print(f"[instruments] {symbol} → EQ match {result}")
                    return result

            # No exact -EQ match — take first result
            first = resp["data"][0]
            result = (first["symboltoken"], "NSE", first["tradingsymbol"])
            _token_cache[symbol] = result
            print(f"[instruments] {symbol} → first result {result}")
            return result

    except Exception as e:
        print(f"[instruments] searchScrip failed for {symbol}: {e}")

    _token_cache[symbol] = (None, None, None)
    return (None, None, None)


def get_live_price(symbol: str) -> float:
    """
    Returns live LTP as a plain float via Angel One ltpData.
    Raises HTTPException if symbol not found or price fetch fails.
    """
    from fastapi import HTTPException

    token, exchange, trading_symbol = get_symbol_token(symbol)

    if not token:
        raise HTTPException(
            status_code=404,
            detail=f"Symbol '{symbol}' not found on NSE/BSE"
        )

    from app.services.angel_one import ltp_data
    resp = ltp_data(exchange, trading_symbol, token)
    print(f"[ltp] {symbol} → {resp}")

    if resp.get("status") and resp.get("data"):
        return float(resp["data"]["ltp"])

    # Auth error — invalidate session so next call re-logs in
    msg = resp.get("message", "")
    if "access" in msg.lower() or "token" in msg.lower() or "auth" in msg.lower():
        from app.services.angel_one import invalidate_session
        invalidate_session()

    raise HTTPException(
        status_code=502,
        detail=f"Price fetch failed for '{symbol}': {msg}"
    )