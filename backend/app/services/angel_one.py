import os
import time
import pyotp
import threading
import queue
import logging
from SmartApi import SmartConnect
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("angel_one")

# Suppress SmartAPI's noisy internal logger
logging.getLogger("SmartApi").setLevel(logging.WARNING)

API_KEY     = os.getenv("ANGEL_API_KEY")
CLIENT_ID   = os.getenv("ANGEL_CLIENT_ID")
PASSWORD    = os.getenv("ANGEL_PASSWORD")
TOTP_SECRET = os.getenv("ANGEL_TOTP_SECRET")

_smart_api     = None
_auth_token    = None
_refresh_token = None
_feed_token    = None
_session_lock  = threading.Lock()
_last_login    = 0.0
SESSION_TTL    = 3600  # 1 hour

# ── Request throttle: max 1 req / 400ms ──────────────────────────────────────
_last_request_time = 0.0
_throttle_lock     = threading.Lock()
MIN_INTERVAL       = 0.4  # seconds between Angel One API calls

def _throttle():
    """Block until it's safe to make another Angel One API call."""
    global _last_request_time
    with _throttle_lock:
        now     = time.time()
        elapsed = now - _last_request_time
        if elapsed < MIN_INTERVAL:
            time.sleep(MIN_INTERVAL - elapsed)
        _last_request_time = time.time()


# ─────────────────────────────────────────────────────────────────────────────
# Session management
# ─────────────────────────────────────────────────────────────────────────────

def _create_session():
    global _smart_api, _auth_token, _refresh_token, _feed_token, _last_login
    _throttle()
    smart_api = SmartConnect(API_KEY)
    totp = pyotp.TOTP(TOTP_SECRET).now()
    data = smart_api.generateSession(CLIENT_ID, PASSWORD, totp)
    if not data.get("status"):
        raise Exception(f"Angel One login failed: {data.get('message')}")
    _auth_token    = data["data"]["jwtToken"]
    _refresh_token = data["data"]["refreshToken"]
    _feed_token    = smart_api.getfeedToken()
    _smart_api     = smart_api
    _last_login    = time.time()
    logger.info(f"[angel_one] Session created for {CLIENT_ID}")
    return _smart_api


def get_session() -> SmartConnect:
    """
    Returns cached session. Re-logins only after TTL expires (1 hour).
    No getProfile call — avoids wasting rate limit quota on health checks.
    """
    global _smart_api, _last_login
    with _session_lock:
        if _smart_api is None or _auth_token is None:
            return _create_session()
        if time.time() - _last_login > SESSION_TTL:
            logger.info("[angel_one] Session TTL expired, re-logging in...")
            return _create_session()
        return _smart_api


def invalidate_session():
    """Force re-login on next get_session() call."""
    global _smart_api, _auth_token, _last_login
    with _session_lock:
        logger.warning("[angel_one] Session invalidated — will re-login on next request")
        _smart_api  = None
        _auth_token = None
        _last_login = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Throttled wrappers for Angel One API calls
# Use these instead of calling smart_api methods directly
# ─────────────────────────────────────────────────────────────────────────────

def ltp_data(exchange: str, trading_symbol: str, token: str) -> dict:
    """Throttled wrapper for smart_api.ltpData()"""
    _throttle()
    smart_api = get_session()
    return smart_api.ltpData(exchange, trading_symbol, token)


def search_scrip(exchange: str, symbol: str) -> dict:
    """Throttled wrapper for smart_api.searchScrip()"""
    _throttle()
    smart_api = get_session()
    return smart_api.searchScrip(exchange, symbol)