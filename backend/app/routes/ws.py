"""
app/routes/ws.py

Polls ltpData every 1s for all subscribed symbols and pushes
price updates to connected browser clients via WebSocket.

Protocol:
  Client → server:  { "action": "subscribe", "symbols": ["RELIANCE", "TCS"] }
  Server → client:  { "symbol": "RELIANCE", "price": 2450.50, "ts": 1713600000.123 }
  Server → client:  { "type": "snapshot", "prices": { "RELIANCE": 2450.50 } }
"""

import asyncio
import json
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.instruments import get_live_price
from app.services.price_cache import set_price, get_price

logger = logging.getLogger("ws")
router = APIRouter()

_price_cache: dict[str, float] = {}
_executor = ThreadPoolExecutor(max_workers=2)  # limit concurrency to respect rate limits


class Client:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.symbols: set[str] = set()
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=500)

    async def send(self, msg: dict):
        try:
            self.queue.put_nowait(msg)
        except asyncio.QueueFull:
            pass


class ConnectionManager:
    def __init__(self):
        self._clients: set[Client] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> Client:
        await ws.accept()
        client = Client(ws)
        async with self._lock:
            self._clients.add(client)
        return client

    async def disconnect(self, client: Client):
        async with self._lock:
            self._clients.discard(client)

    async def all_symbols(self) -> set[str]:
        async with self._lock:
            out: set[str] = set()
            for c in self._clients:
                out.update(c.symbols)
            return out

    async def broadcast(self, symbol: str, price: float):
        msg = {"symbol": symbol, "price": price, "ts": time.time()}
        async with self._lock:
            targets = [c for c in self._clients if symbol in c.symbols]
        for client in targets:
            await client.send(msg)


manager = ConnectionManager()
_polling_task: asyncio.Task | None = None


def _fetch_price_sync(sym: str) -> tuple[str, float | None]:
    """Runs in thread pool — calls Angel One ltpData."""
    try:
        price = get_live_price(sym)
        return (sym, price)
    except Exception as e:
        logger.debug(f"[ws] price fetch failed for {sym}: {e}")
        return (sym, None)


async def _poll_prices():
    """Background task: polls every 1s, broadcasts price changes."""
    loop = asyncio.get_running_loop()
    while True:
        await asyncio.sleep(5)
        symbols = await manager.all_symbols()
        if not symbols:
            continue

        # Fetch all symbols concurrently in thread pool
        futures = [
            loop.run_in_executor(_executor, _fetch_price_sync, sym)
            for sym in symbols
        ]
        results = await asyncio.gather(*futures, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                continue
            sym, price = result
            if price is None:
                continue
            prev = _price_cache.get(sym)
            if price != prev:
                _price_cache[sym] = price
                set_price(sym, price)  # update shared cache for HTTP routes
                await manager.broadcast(sym, price)
                logger.debug(f"[ws] {sym}: {prev} → {price}")


def _ensure_polling():
    global _polling_task
    if _polling_task is None or _polling_task.done():
        _polling_task = asyncio.create_task(_poll_prices())
        logger.info("[ws] polling task started")


@router.websocket("/ws/prices")
async def prices_ws(websocket: WebSocket):
    client = await manager.connect(websocket)
    _ensure_polling()

    async def writer():
        try:
            while True:
                msg = await client.queue.get()
                await client.ws.send_json(msg)
        except Exception:
            pass

    writer_task = asyncio.create_task(writer())

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("action") == "subscribe":
                symbols = [s.upper() for s in msg.get("symbols", [])]
                client.symbols.update(symbols)
                logger.info(f"[ws] subscribed: {symbols}")

                # Snapshot of already-cached prices
                snapshot = {s: (_price_cache.get(s) or get_price(s)) for s in symbols if (_price_cache.get(s) or get_price(s))}
                if snapshot:
                    await client.send({"type": "snapshot", "prices": snapshot})

            elif msg.get("action") == "unsubscribe":
                symbols = [s.upper() for s in msg.get("symbols", [])]
                client.symbols.difference_update(symbols)

    except WebSocketDisconnect:
        logger.info("[ws] client disconnected")
    except Exception as e:
        logger.error(f"[ws] error: {e}")
    finally:
        writer_task.cancel()
        await manager.disconnect(client)