"use client";

import { useRouter }       from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { FiPlus, FiExternalLink, FiRefreshCw } from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge, MarketClosedBanner, PriceCell } from "@/hooks/MarketUI";
import { useLivePrices }   from "@/hooks/useLivePrices";
import { apiFetch }        from "@/lib/apiFetch";
import ParticleCanvas      from "@/components/ParticleCanvas";

/* ─── Tokens ────────────────────────────────────────────────────── */
const BG     = "#111111";
const CARD   = "rgba(26,26,26,0.85)";
const SURF   = "#222222";
const BDR    = "#2c2c2c";
const T1     = "#f0f0ee";
const T2     = "#888884";
const T3     = "#555552";
const UP     = "#3dba6a";
const DN     = "#e05555";
const UP_BG  = "rgba(61,186,106,0.08)";
const DN_BG  = "rgba(224,85,85,0.08)";
const UP_BDR = "rgba(61,186,106,0.20)";
const DN_BDR = "rgba(224,85,85,0.20)";

interface Stock {
  ticker: string; shares: number;
  avg_cost_inr: number; avg_cost_usd: number;
  invested: number; current_price_inr: number;
  current_price_usd: number; current_value: number;
  profit_loss: number; percent_change: number;
}

const fmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Shared components ─────────────────────────────────────────── */
function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: CARD, border: `0.5px solid ${BDR}`, borderRadius: 12,
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", color: T3, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function Badge({ children, color = "neu" }: { children: React.ReactNode; color?: "up"|"dn"|"neu" }) {
  const bg  = color === "up" ? UP_BG  : color === "dn" ? DN_BG  : "rgba(255,255,255,0.05)";
  const bdr = color === "up" ? UP_BDR : color === "dn" ? DN_BDR : BDR;
  const cl  = color === "up" ? UP     : color === "dn" ? DN     : T3;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: bg, border: `0.5px solid ${bdr}`, color: cl, letterSpacing: "0.04em" }}>
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function Portfolio() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const [stocks,      setStocks]      = useState<Stock[]>([]);
  const [fetching,    setFetching]    = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchPortfolio = useCallback(async () => {
    setFetching(true);
    try {
      const data = await apiFetch("/portfolio/all");
      setStocks(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) { console.error(err); }
    setFetching(false);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchPortfolio();
  }, []);

  const symbols = stocks.map(s => s.ticker);
  const { prices, prevPrices, connected } = useLivePrices(symbols, !!marketStatus?.is_live);

  const enriched = stocks.map(s => {
    const livePrice    = prices[s.ticker] ?? s.current_price_inr;
    const currentValue = s.shares * livePrice;
    const profitLoss   = currentValue - s.invested;
    const pctChange    = s.invested > 0 ? (profitLoss / s.invested) * 100 : 0;
    return { ...s, current_price_inr: livePrice, current_value: currentValue, profit_loss: profitLoss, percent_change: pctChange };
  });

  const totalInvested = enriched.reduce((s, p) => s + (p.invested ?? 0), 0);
  const totalValue    = enriched.reduce((s, p) => s + (p.current_value ?? 0), 0);
  const totalPnL      = totalValue - totalInvested;
  const totalPct      = totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : "0.00";
  const portfolioUp   = totalPnL >= 0;

  return (
    <>
      <ParticleCanvas />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111111; overflow-x: clip; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { from { background-position:200% 0; } to { background-position:-200% 0; } }
        @keyframes fade-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-d { 0%,100%{opacity:1;} 50%{opacity:.35;} }

        .fade-up { animation: fade-up .35s ease-out both; }
        .live-dot { width:6px; height:6px; border-radius:50%; background:${UP}; display:inline-block; animation:pulse-d 1.8s ease-in-out infinite; }

        /* Table */
        .pf-table { width: 100%; border-collapse: collapse; font-family: 'DM Sans', sans-serif; }
        .pf-table th {
          text-align: left; padding: 10px 16px;
          font-size: 10px; font-weight: 500; letter-spacing: 0.07em;
          color: ${T3}; text-transform: uppercase;
          border-bottom: 0.5px solid ${BDR};
        }
        .pf-table td {
          padding: 13px 16px;
          font-size: 13px; color: ${T2};
          border-bottom: 0.5px solid ${BDR};
          vertical-align: middle;
        }
        .pf-table tr:last-child td { border-bottom: none; }
        .pf-table tbody tr { transition: background .15s; }
        .pf-table tbody tr:hover { background: rgba(255,255,255,0.02); }

        /* Mobile cards */
        .pf-mobile-card {
          background: ${CARD}; border: 0.5px solid ${BDR}; border-radius: 10px;
          padding: 14px 16px; backdrop-filter: blur(10px);
        }

        /* Buttons */
        .pf-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 9px 18px; border-radius: 8px;
          background: ${T1}; color: ${BG};
          border: none; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: opacity .15s, transform .15s;
        }
        .pf-btn-primary:hover { opacity: .88; transform: translateY(-1px); }

        .pf-btn-ghost {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 8px 16px; border-radius: 8px;
          background: transparent; color: ${T2};
          border: 0.5px solid ${BDR}; font-size: 13px; font-weight: 400;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: border-color .15s, color .15s;
        }
        .pf-btn-ghost:hover { border-color: ${T2}; color: ${T1}; }

        @media (max-width: 768px) {
          .pf-desktop { display: none !important; }
          .pf-header  { flex-direction: column !important; }
          .pf-summary { grid-template-columns: 1fr 1fr !important; }
        }
        @media (min-width: 769px) {
          .pf-mobile { display: none !important; }
        }
      `}</style>

      <div style={{
        position: "relative", zIndex: 4,
        minHeight: "100vh", padding: "20px 24px",
        fontFamily: "'DM Sans', sans-serif", color: T1,
        display: "flex", flexDirection: "column", gap: 12,
      }}>

        {/* ── HEADER ── */}
        <div className="pf-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(20px,3vw,26px)", color: T1, letterSpacing: "-0.02em", lineHeight: 1 }}>
                My Portfolio
              </h1>
              <MarketBadge status={marketStatus} />
              {marketStatus?.is_live && (
                <Badge color={connected ? "up" : "neu"}>
                  {connected ? "⚡ Live" : "⟳ Connecting…"}
                </Badge>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <p style={{ fontSize: 12, color: T3 }}>Holdings from your transaction history</p>
              {lastUpdated && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T3 }}>
                  <FiRefreshCw size={11} style={{ animation: fetching ? "spin .7s linear infinite" : "none", color: fetching ? UP : T3 }} />
                  {lastUpdated.toLocaleTimeString("en-IN")}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="pf-btn-primary" onClick={() => router.push("/transactions")}>
              <FiPlus size={13} /> Add
            </button>
            <button className="pf-btn-ghost" onClick={() => router.push("/transactions")}>
              <FiExternalLink size={13} /> View Trades
            </button>
          </div>
        </div>

        <MarketClosedBanner status={marketStatus} />

        {/* ── INFO BANNER ── */}
        <div style={{ background: "rgba(240,240,238,0.04)", border: `0.5px solid ${BDR}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T2, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: T3 }}>ℹ</span>
          Portfolio is computed from your transactions.{" "}
          <span style={{ color: UP, cursor: "pointer" }} onClick={() => router.push("/transactions")}>
            Manage transactions →
          </span>
        </div>

        {/* ── SUMMARY CARDS ── */}
        {enriched.length > 0 && (
          <div className="pf-summary fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {/* Invested */}
            <Card style={{ padding: "14px 16px" }}>
              <SectionLabel>Invested</SectionLabel>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(16px,2.5vw,22px)", color: T1, letterSpacing: "-0.02em", lineHeight: 1, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fmt(totalInvested)}
              </div>
            </Card>

            {/* Current value */}
            <Card style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <SectionLabel>Current value</SectionLabel>
                {marketStatus?.is_live && connected && <span className="live-dot" />}
              </div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(16px,2.5vw,22px)", color: T1, letterSpacing: "-0.02em", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fmt(totalValue)}
              </div>
            </Card>

            {/* P&L */}
            <div style={{
              background: portfolioUp ? UP_BG : DN_BG,
              border: `0.5px solid ${portfolioUp ? UP_BDR : DN_BDR}`,
              borderRadius: 12, padding: "14px 16px",
              backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            }}>
              <SectionLabel>Total P&L</SectionLabel>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(16px,2.5vw,22px)", color: portfolioUp ? UP : DN, letterSpacing: "-0.02em", lineHeight: 1, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {totalPnL >= 0 ? "+" : ""}{fmt(totalPnL)}
              </div>
              <div style={{ fontSize: 11, color: portfolioUp ? UP : DN, marginTop: 5, opacity: 0.7 }}>
                {portfolioUp ? "▲" : "▼"} {Math.abs(Number(totalPct))}%
              </div>
            </div>
          </div>
        )}

        {/* ── HOLDINGS ── */}
        {initialLoad ? (
          <Card style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 26, height: 26, border: `2px solid rgba(61,186,106,0.2)`, borderTopColor: UP, borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 12, color: T3 }}>Fetching portfolio…</div>
          </Card>

        ) : enriched.length === 0 ? (
          <Card style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color: SURF, marginBottom: 12 }}>₹</div>
            <div style={{ fontSize: 14, color: T2, marginBottom: 16 }}>No holdings yet</div>
            <button className="pf-btn-primary" style={{ margin: "0 auto" }} onClick={() => router.push("/transactions")}>
              <FiPlus size={13} /> Add your first transaction
            </button>
          </Card>

        ) : (
          <div className="fade-up">
            {/* Desktop table */}
            <Card className="pf-desktop" style={{ overflow: "hidden" }}>
              <table className="pf-table">
                <thead>
                  <tr>
                    {["Stock", "Shares", "Avg Cost", "Live Price", "Value", "P&L", "Change"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(stock => {
                    const up = (stock.profit_loss ?? 0) >= 0;
                    return (
                      <tr key={stock.ticker}>
                        {/* Ticker */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: UP }}>{stock.ticker}</span>
                            {marketStatus?.is_live && connected && <span className="live-dot" />}
                          </div>
                        </td>
                        {/* Shares */}
                        <td style={{ color: T2 }}>{stock.shares}</td>
                        {/* Avg cost */}
                        <td style={{ color: T3 }}>
                          {stock.avg_cost_inr != null ? fmt(stock.avg_cost_inr) : "—"}
                        </td>
                        {/* Live price */}
                        <td style={{ color: T1, fontWeight: 500 }}>
                          <PriceCell value={stock.current_price_inr} prevValue={prevPrices[stock.ticker]} />
                        </td>
                        {/* Value */}
                        <td style={{ color: T1 }}>
                          {stock.current_value != null ? fmt(stock.current_value) : "—"}
                        </td>
                        {/* P&L */}
                        <td style={{ color: up ? UP : DN, fontWeight: 500 }}>
                          {stock.profit_loss != null
                            ? `${stock.profit_loss >= 0 ? "+" : ""}${fmt(stock.profit_loss)}`
                            : "—"}
                        </td>
                        {/* Change badge */}
                        <td>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                            background: up ? UP_BG : DN_BG,
                            border: `0.5px solid ${up ? UP_BDR : DN_BDR}`,
                            color: up ? UP : DN, letterSpacing: "0.03em",
                          }}>
                            {up ? "▲" : "▼"} {Math.abs(stock.percent_change).toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {/* Mobile cards */}
            <div className="pf-mobile" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {enriched.map(stock => {
                const up = (stock.profit_loss ?? 0) >= 0;
                return (
                  <div key={stock.ticker} className="pf-mobile-card">
                    {/* Header row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: UP }}>{stock.ticker}</span>
                        {marketStatus?.is_live && connected && <span className="live-dot" />}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                        background: up ? UP_BG : DN_BG, border: `0.5px solid ${up ? UP_BDR : DN_BDR}`,
                        color: up ? UP : DN,
                      }}>
                        {up ? "▲" : "▼"} {Math.abs(stock.percent_change).toFixed(2)}%
                      </span>
                    </div>

                    {/* Data grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                      {[
                        { label: "Live Price",     value: <PriceCell value={stock.current_price_inr} prevValue={prevPrices[stock.ticker]} className="text-sm font-medium" /> },
                        { label: "Shares",         value: <span style={{ color: T2 }}>{stock.shares}</span> },
                        { label: "Avg Cost",       value: <span style={{ color: T3 }}>{stock.avg_cost_inr != null ? fmt(stock.avg_cost_inr) : "—"}</span> },
                        { label: "Current Value",  value: <span style={{ color: T1 }}>{stock.current_value != null ? fmt(stock.current_value) : "—"}</span> },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: T3, letterSpacing: "0.05em", marginBottom: 3 }}>{label.toUpperCase()}</div>
                          <div style={{ fontSize: 13 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* P&L */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${BDR}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <SectionLabel>P&L</SectionLabel>
                      <span style={{ fontSize: 13, fontWeight: 500, color: up ? UP : DN }}>
                        {stock.profit_loss != null
                          ? `${stock.profit_loss >= 0 ? "+" : ""}${fmt(stock.profit_loss)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        {enriched.length > 0 && marketStatus && (
          <div style={{ textAlign: "center", fontSize: 11, color: T3, paddingBottom: 4 }}>
            {marketStatus.is_live
              ? connected
                ? "⚡ Streaming live prices via Angel One WebSocket"
                : "Reconnecting to live feed…"
              : `Market closed · Opens ${marketStatus.market_open} IST weekdays`}
          </div>
        )}

      </div>
    </>
  );
}