/**
 * components/Skeletons.tsx
 * ─────────────────────────
 * Drop-in skeleton components used across every page.
 * The shimmer + spin keyframes are injected once here — no need
 * to re-declare them in each page's <style> block.
 */

"use client";

const BDR = "#2c2c2c";
const T3  = "#555552";
const UP  = "#3dba6a";

/* ── Global keyframes — injected once ─────────────────────────── */
const GLOBAL_STYLES = `
  @keyframes shimmer {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .skel {
    background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%);
    background-size: 400% 100%;
    animation: shimmer 1.5s infinite;
  }
  .fade-up { animation: fade-up .35s ease-out both; }
`;

/* ── Inject styles once ────────────────────────────────────────── */
if (typeof document !== "undefined") {
  const id = "__quantai-skel-styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = GLOBAL_STYLES;
    document.head.appendChild(s);
  }
}

/* ══════════════════════════════════════════════════════════════════
   1. Skel — base shimmer block
   Usage: <Skel w={120} h={14} />
════════════════════════════════════════════════════════════════════ */
export function Skel({
  w = "100%", h = 16, radius = 6,
  style,
}: {
  w?: string | number;
  h?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skel"
      style={{ width: w, height: h, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════
   2. SkeletonStatCard — matches Dashboard / P&L stat card layout
   Usage: <SkeletonStatCard />
════════════════════════════════════════════════════════════════════ */
export function SkeletonStatCard() {
  return (
    <div style={{
      background: "rgba(26,26,26,0.85)", border: `0.5px solid ${BDR}`,
      borderRadius: 12, padding: "16px 18px",
    }}>
      <Skel w={60}  h={10} style={{ marginBottom: 10 }} />
      <Skel w="70%" h={26} style={{ marginBottom: 8  }} />
      <Skel w="50%" h={11} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   3. SkeletonCard — generic card with N shimmer rows
   Usage: <SkeletonCard rows={4} />
════════════════════════════════════════════════════════════════════ */
export function SkeletonCard({
  rows = 3,
  style,
}: {
  rows?: number;
  style?: React.CSSProperties;
}) {
  const widths = [100, 75, 85, 60, 90, 70, 80];
  return (
    <div style={{
      background: "rgba(26,26,26,0.85)", border: `0.5px solid ${BDR}`,
      borderRadius: 12, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 10, ...style,
    }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skel key={i} w={`${widths[i % widths.length]}%`} h={i === 0 ? 20 : 13} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   4. SkeletonTableRow — matches stock/transaction row layout
   Usage: <SkeletonTableRow cols={4} />
════════════════════════════════════════════════════════════════════ */
export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 18px", borderBottom: `0.5px solid ${BDR}`,
    }}>
      {/* Left: ticker + name */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Skel w={80}  h={14} />
        <Skel w={120} h={10} />
      </div>
      {/* Right cols */}
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Skel key={i} w={60} h={13} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   5. SkeletonChartCard — shimmer rows that look like a chart
   Usage: <SkeletonChartCard height={260} />
════════════════════════════════════════════════════════════════════ */
export function SkeletonChartCard({ height = 260 }: { height?: number }) {
  const bars = [40, 60, 45, 75, 55, 80, 65, 90, 70, 85, 60, 95, 50, 70, 88];
  return (
    <div style={{
      background: "rgba(26,26,26,0.85)", border: `0.5px solid ${BDR}`,
      borderRadius: 12, padding: "16px 18px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Skel w={100} h={12} />
        <Skel w={80}  h={12} />
      </div>
      {/* Fake bar chart */}
      <div style={{
        height, display: "flex", alignItems: "flex-end",
        gap: 4, padding: "0 8px",
      }}>
        {bars.map((h, i) => (
          <div
            key={i}
            className="skel"
            style={{
              flex: 1, height: `${h}%`,
              borderRadius: "3px 3px 0 0",
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   6. SkeletonMoverRow — matches Market page gainers/losers rows
   Usage: <SkeletonMoverRow />
════════════════════════════════════════════════════════════════════ */
export function SkeletonMoverRow() {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "11px 16px", borderBottom: `0.5px solid ${BDR}`,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Skel w={70} h={13} />
        <Skel w={100} h={10} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
        <Skel w={60} h={13} />
        <Skel w={40} h={10} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   7. PageLoader — full-section loading spinner
   Usage: <PageLoader message="Fetching market data…" />
════════════════════════════════════════════════════════════════════ */
export function PageLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "80px 0", gap: 12,
    }}>
      <div style={{
        width: 28, height: 28,
        border: "2px solid rgba(61,186,106,0.2)",
        borderTopColor: UP,
        borderRadius: "50%",
        animation: "spin .7s linear infinite",
      }} />
      <div style={{
        fontSize: 12, color: T3,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {message}
      </div>
    </div>
  );
}