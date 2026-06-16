"""
app/services/price_cache.py

Shared in-memory price cache.
- WS poller writes here every 5s
- HTTP routes (portfolio, transactions, market) read from here
- Falls back to direct Angel One call only on cache miss (first load)
"""

import time
from typing import Optional

# { "RELIANCE": (1364.80, 1713600000.0) }
_cache: dict[str, tuple[float, float]] = {}

STALE_AFTER = 60  # seconds — treat price as stale after 1 min


def set_price(symbol: str, price: float):
    _cache[symbol.upper()] = (price, time.time())


def get_price(symbol: str) -> Optional[float]:
    entry = _cache.get(symbol.upper())
    if not entry:
        return None
    price, ts = entry
    if time.time() - ts > STALE_AFTER:
        return None  # stale — caller should refresh
    return price


def get_price_or_fetch(symbol: str) -> Optional[float]:
    """
    Returns cached price if fresh.
    Falls back to live Angel One fetch only on cache miss.
    Writes result back to cache.
    """
    cached = get_price(symbol)
    if cached is not None:
        return cached

    # Cache miss — fetch once and cache it
    try:
        from app.services.instruments import get_live_price
        price = get_live_price(symbol)
        if price and price > 0:
            set_price(symbol, price)
            return price
    except Exception as e:
        print(f"[price_cache] fetch failed for {symbol}: {e}")
    return None