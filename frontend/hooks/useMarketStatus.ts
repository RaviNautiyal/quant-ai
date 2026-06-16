import { useState, useEffect, useCallback } from "react";

export interface MarketStatus {
  is_live: boolean;
  current_time_ist: string;
  market_open: string;
  market_close: string;
  day: string;
}

export function useMarketStatus(): MarketStatus  {
  const [status, setStatus] = useState<MarketStatus>({
  is_live: false,
  current_time_ist: "",
  market_open: "09:15",
  market_close: "15:30",
  day: "",
});
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/market/status");
      if (res.ok) setStatus(await res.json());
    } catch (e) {
      console.error("[useMarketStatus] failed:", e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return status;
}