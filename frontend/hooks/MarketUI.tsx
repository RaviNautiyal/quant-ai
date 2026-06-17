"use client";
import { useState, useEffect, useRef } from "react";
import type { MarketStatus } from "@/hooks/useMarketStatus";

/* ─── Tokens ────────────────────────────────────────────────────── */
const BDR = "#2c2c2c";
const T2  = "#888884";
const T3  = "#555552";
const UP  = "#3dba6a";

// ── Market Live Badge ─────────────────────────────────────────────
export function MarketBadge({ status }: { status: MarketStatus | null }) {
  if (!status) return null;
  const live = status.is_live;
  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           5,
      fontSize:      10,
      fontWeight:    600,
      letterSpacing: "0.06em",
      padding:       "3px 10px",
      borderRadius:  20,
      border:        `0.5px solid ${live ? "rgba(61,186,106,0.25)" : BDR}`,
      background:    live ? "rgba(61,186,106,0.07)" : "rgba(255,255,255,0.04)",
      color:         live ? UP : T3,
      fontFamily:    "'DM Sans', sans-serif",
      userSelect:    "none",
      textTransform: "uppercase",
    }}>
      <span style={{
        width:        5,
        height:       5,
        borderRadius: "50%",
        background:   live ? UP : T3,
        display:      "inline-block",
        flexShrink:   0,
        animation:    live ? "mkt-pulse 1.8s ease-in-out infinite" : "none",
      }}/>
      {live ? "Open" : "Closed"}
      <style>{`
        @keyframes mkt-pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
      `}</style>
    </span>
  );
}

// ── Market Closed Banner ──────────────────────────────────────────
export function MarketClosedBanner({ status }: { status: MarketStatus | null }) {
  if (!status || status.is_live) return null;

  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      gap:            12,
      padding:        "9px 14px",
      borderRadius:   8,
      background:     "rgba(255,255,255,0.02)",
      border:         `0.5px solid ${BDR}`,
      fontFamily:     "'DM Sans', sans-serif",
      flexWrap:       "wrap",
    }}>
      {/* Left */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke={T3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink:0 }}>
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style={{ fontSize:12, color:T2 }}>Market closed</span>
        <span style={{ width:3, height:3, borderRadius:"50%", background:T3, display:"inline-block", flexShrink:0 }}/>
        <span style={{ fontSize:12, color:T3 }}>Prices from last session</span>
      </div>

      {/* Right */}
      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
        <span style={{ fontSize:11, color:T3 }}>Opens</span>
        <span style={{
          fontSize:      11,
          fontWeight:    500,
          color:         T2,
          background:    "rgba(255,255,255,0.04)",
          border:        `0.5px solid ${BDR}`,
          borderRadius:  5,
          padding:       "2px 8px",
          letterSpacing: "0.02em",
        }}>
          {status.market_open} IST
        </span>
        <span style={{ fontSize:11, color:T3 }}>weekdays</span>
      </div>
    </div>
  );
}

// ── Price Cell with flash animation ──────────────────────────────
export function PriceCell({
  value,
  prevValue,
  prefix = "₹",
  className = "",
}: {
  value:      number | null | undefined;
  prevValue:  number | null | undefined;
  prefix?:    string;
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
    flash === "up"
      ? { backgroundColor: "rgba(52,211,153,0.18)",  borderRadius: 4, transition: "background-color 0.8s ease-out" }
      : flash === "down"
      ? { backgroundColor: "rgba(248,113,113,0.18)", borderRadius: 4, transition: "background-color 0.8s ease-out" }
      : { backgroundColor: "transparent",             transition: "background-color 0.8s ease-out" };

  if (value == null)
    return <span style={flashStyle} className={`px-1 inline-block ${className}`}>—</span>;

  return (
    <span style={flashStyle} className={`px-1 inline-block ${className}`}>
      {prefix}{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}