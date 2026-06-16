"use client";
import { useState, useEffect, useRef } from "react";
import type { MarketStatus } from "@/hooks/useMarketStatus";

// ── Market Live Badge ─────────────────────────────────────────────────────────
export function MarketBadge({ status }: { status: MarketStatus | null }) {
  if (!status) return null;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-widest uppercase select-none
          ${status.is_live
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            : "bg-white/5 text-gray-500 border border-white/10"
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
          ${status.is_live ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`}
        />
        {status.is_live ? "Live" : "Closed"}
      </span>
      <span className="text-xs text-gray-600 hidden sm:block">
        {status.is_live ? `Closes ${status.market_close} IST` : `Opens ${status.market_open} IST`}
      </span>
    </div>
  );
}

// ── Market Closed Banner ──────────────────────────────────────────────────────
export function MarketClosedBanner({ status }: { status: MarketStatus | null }) {
  if (!status || status.is_live) return null;
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3 flex items-center gap-3 text-xs text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
      Market is closed · Prices shown are from last session ·
      Live updates resume at <span className="text-gray-400 font-medium ml-1">{status.market_open} IST weekdays</span>
    </div>
  );
}

// ── Price Cell with flash animation ──────────────────────────────────────────
export function PriceCell({
  value,
  prevValue,
  prefix = "₹",
  className = "",
}: {
  value: number | null | undefined;
  prevValue: number | null | undefined;
  prefix?: string;
  className?: string;
}) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (prevValue == null || value == null || value === prevValue) return;
    setFlash(value > prevValue ? "up" : "down");
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [value]);

  const flashStyle: React.CSSProperties =
    flash === "up"   ? { backgroundColor: "rgba(52,211,153,0.18)", borderRadius: 4, transition: "background-color 0.8s ease-out" }
    : flash === "down" ? { backgroundColor: "rgba(248,113,113,0.18)", borderRadius: 4, transition: "background-color 0.8s ease-out" }
    : { backgroundColor: "transparent", transition: "background-color 0.8s ease-out" };

  if (value == null)
    return <span className={`px-1 inline-block text-gray-600 ${className}`}>—</span>;

  return (
    <span style={flashStyle} className={`px-1 inline-block ${className}`}>
      {prefix}{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}