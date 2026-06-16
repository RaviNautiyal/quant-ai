import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/prices`;
type PriceMap = Record<string, number>;

interface UseLivePricesReturn {
  prices: PriceMap;
  prevPrices: PriceMap;
  connected: boolean;
}

export function useLivePrices(
  symbols: string[],
  isMarketLive: boolean
): UseLivePricesReturn {
  const [prices,     setPrices]     = useState<PriceMap>({});
  const [prevPrices, setPrevPrices] = useState<PriceMap>({});
  const [connected,  setConnected]  = useState(false);

  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const symbolsRef     = useRef<string[]>(symbols);
  const intentionalRef = useRef(false); // true when WE closed the socket on purpose

  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);

  const connect = useCallback(() => {
    if (!isMarketLive || symbols.length === 0) return;

    // Clean up existing connection
    if (wsRef.current) {
      intentionalRef.current = true;      // mark as intentional so onclose doesn't reconnect
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    intentionalRef.current = false;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ action: "subscribe", symbols: symbolsRef.current }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "snapshot") {
          setPrices(prev => ({ ...prev, ...msg.prices }));
          return;
        }

        const { symbol, price } = msg;
        if (!symbol || price == null) return;

        setPrices(prev => {
          setPrevPrices(pp => ({ ...pp, [symbol]: prev[symbol] ?? price }));
          return { ...prev, [symbol]: price };
        });
      } catch (e) {
        // Only log parse errors, not connection errors
        console.warn("[useLivePrices] parse error", e);
      }
    };

    ws.onerror = () => {
      // Browser WebSocket errors always arrive as empty Event objects —
      // logging them is noise. The onclose handler below does the real work.
      // Only warn in dev so you know the WS couldn't connect.
      if (process.env.NODE_ENV === "development" && !intentionalRef.current) {
        console.warn("[useLivePrices] WebSocket could not connect — market may be closed or backend unreachable.");
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (intentionalRef.current) return; // we closed it on purpose, don't reconnect
      // Reconnect after 3s if market is still live
      reconnectTimer.current = setTimeout(() => {
        if (isMarketLive) connect();
      }, 3000);
    };
  }, [isMarketLive, symbols.join(",")]);

  useEffect(() => {
    if (isMarketLive && symbols.length > 0) {
      connect();
    } else {
      // Market closed — close the connection intentionally
      intentionalRef.current = true;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    }

    return () => {
      intentionalRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isMarketLive, symbols.join(",")]);

  // If new symbols are added while already connected — send another subscribe
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
      wsRef.current.send(JSON.stringify({ action: "subscribe", symbols }));
    }
  }, [symbols.join(",")]);

  return { prices, prevPrices, connected };
}