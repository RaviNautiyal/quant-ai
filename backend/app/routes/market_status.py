# app/routes/market_status.py
from fastapi import APIRouter
from datetime import datetime, time, date
import pytz
import requests
import logging
from functools import lru_cache

router = APIRouter()
logger = logging.getLogger(__name__)

IST          = pytz.timezone("Asia/Kolkata")
MARKET_OPEN  = time(9, 15)
MARKET_CLOSE = time(15, 30)

# ── Fetch NSE holidays dynamically ───────────────────────────────────────────
# NSE provides an official API for trading holidays.
# We cache the result per year so we only hit the API once per year per process.

@lru_cache(maxsize=5)
def fetch_nse_holidays(year: int) -> set:
    """
    Fetch NSE equity market trading holidays for a given year.
    Cached per year — only one HTTP call per year per server process.
    Falls back to an empty set on failure (market assumed open — safe default).
    """
    try:
        url = "https://www.nseindia.com/api/holiday-master?type=trading"
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept":     "application/json",
            "Referer":    "https://www.nseindia.com/",
        }
        # NSE requires a session cookie — establish one first
        session = requests.Session()
        session.get("https://www.nseindia.com", headers=headers, timeout=10)
        resp = session.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        holidays = set()

        # Response shape: { "CM": [ { "tradingDate": "01-Jan-2026", ... }, ... ], ... }
        # "CM" = Capital Markets (equities)
        cm_holidays = data.get("CM", [])
        for item in cm_holidays:
            try:
                d = datetime.strptime(item["tradingDate"], "%d-%b-%Y").date()
                if d.year == year:
                    holidays.add(d)
            except Exception:
                continue

        logger.info(f"[market_status] Loaded {len(holidays)} NSE holidays for {year}")
        return holidays

    except Exception as e:
        logger.warning(f"[market_status] Failed to fetch NSE holidays for {year}: {e}")
        return set()


def is_market_holiday(d: date) -> bool:
    """Check if a given date is an NSE trading holiday."""
    holidays = fetch_nse_holidays(d.year)
    return d in holidays


def clear_holiday_cache():
    """Call this to force a refresh — useful at year rollover."""
    fetch_nse_holidays.cache_clear()


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/market/status")
def get_market_status():
    now_ist      = datetime.now(IST)
    current_time = now_ist.time()
    today        = now_ist.date()

    is_weekday = now_ist.weekday() < 5   # Mon-Fri = 0-4
    is_holiday = is_market_holiday(today)

    is_live = (
        is_weekday and
        not is_holiday and
        MARKET_OPEN <= current_time <= MARKET_CLOSE
    )

    # Human-readable closure reason
    if not is_weekday:
        reason = "Weekend"
    elif is_holiday:
        reason = "Market Holiday"
    elif current_time < MARKET_OPEN:
        reason = "Pre-market"
    elif current_time > MARKET_CLOSE:
        reason = "After hours"
    else:
        reason = None

    return {
        "is_live":          is_live,
        "current_time_ist": now_ist.strftime("%H:%M:%S"),
        "market_open":      "09:15",
        "market_close":     "15:30",
        "day":              now_ist.strftime("%A"),
        "is_holiday":       is_holiday,
        "closure_reason":   reason,
    }


@router.post("/market/refresh-holidays")
def refresh_holidays():
    """
    Force-clear the holiday cache so it re-fetches from NSE.
    Call this manually at year start or if holidays seem wrong.
    """
    clear_holiday_cache()
    return {"message": "Holiday cache cleared - will re-fetch on next request"}