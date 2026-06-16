"use client";
import { SkeletonStatCard, SkeletonTableRow, SkeletonChartCard, SkeletonMoverRow, PageLoader, Skel } from "@/components/Skeletons";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLivePrices } from "@/hooks/useLivePrices";
import { MarketBadge, MarketClosedBanner } from "@/hooks/MarketUI";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { apiFetch, apiPost, apiDelete } from "@/lib/apiFetch";
import { FiRefreshCw } from "react-icons/fi";
import ParticleCanvas from "@/components/ParticleCanvas";
import { PushNotificationToggle } from "@/components/pushNotificationToggle";
/* ─── Tokens ────────────────────────────────────────────────────── */
const BG      = "#111111";
const CARD    = "rgba(26,26,26,0.85)";
const BDR     = "#2c2c2c";
const T1      = "#f0f0ee";
const T2      = "#888884";
const T3      = "#555552";
const UP      = "#3dba6a";
const DN      = "#e05555";
const AMB     = "#c4943a";
const UP_BG   = "rgba(61,186,106,0.08)";
const DN_BG   = "rgba(224,85,85,0.08)";
const AMB_BG  = "rgba(196,148,58,0.08)";
const UP_BDR  = "rgba(61,186,106,0.20)";
const DN_BDR  = "rgba(224,85,85,0.20)";
const AMB_BDR = "rgba(196,148,58,0.20)";

/* ─── Types ─────────────────────────────────────────────────────── */
interface Alert {
  ticker:        string;
  target_price:  number | null;
  condition:     "above" | "below";
  triggered:     boolean;
  created_at:    string;
  triggered_ts?: string;
  current_price?: number | null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function formatINR(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function distanceLabel(current: number | null | undefined, target: number | null): string {
  if (current == null || target == null || current === 0 || Number.isNaN(current) || Number.isNaN(target)) return "—";
  const pct = ((target - current) / current) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function distanceColor(current: number | null | undefined, target: number | null, condition: "above" | "below"): string {
  if (current == null || target == null || Number.isNaN(current) || Number.isNaN(target)) return T3;
  const almostThere = condition === "above" ? current >= target * 0.98 : current <= target * 1.02;
  return almostThere ? AMB : T3;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

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

function Badge({ children, color = "neu" }: { children: React.ReactNode; color?: "up" | "dn" | "amb" | "neu" }) {
  const bg  = color === "up" ? UP_BG  : color === "dn" ? DN_BG  : color === "amb" ? AMB_BG  : "rgba(255,255,255,0.05)";
  const bdr = color === "up" ? UP_BDR : color === "dn" ? DN_BDR : color === "amb" ? AMB_BDR : BDR;
  const cl  = color === "up" ? UP     : color === "dn" ? DN     : color === "amb" ? AMB     : T3;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, background:bg, border:`0.5px solid ${bdr}`, color:cl, letterSpacing:"0.04em" }}>
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function AlertsPage() {
  const marketStatus = useMarketStatus();
  const isMarketLive = marketStatus?.is_live ?? false;

  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetching,    setFetching]    = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab,   setActiveTab]   = useState<"watching" | "triggered">("watching");
  const [tickerInput, setTickerInput] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition,   setCondition]   = useState<"above" | "below">("above");
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formOpen,    setFormOpen]    = useState(false);

  const symbols = useMemo(() => [...new Set(alerts.map((a) => a.ticker))], [alerts]);
  const { prices, connected } = useLivePrices(symbols, isMarketLive);

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setFetching(true);
    try {
      const data = await apiFetch("/alerts/all");
      setAlerts(data);
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setFetching(false); }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(() => fetchAlerts(true), 30_000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const handleCreate = async () => {
    if (!tickerInput || !targetPrice) return;
    setCreating(true); setCreateError(null);
    try {
      await apiPost("/alerts/add", {
        ticker: tickerInput.toUpperCase().trim(),
        target_price: parseFloat(targetPrice),
        condition,
      });
      setTickerInput(""); setTargetPrice(""); setFormOpen(false);
      fetchAlerts(true);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
    } finally { setCreating(false); }
  };

  const handleDelete = async (ticker: string) => {
    try {
      await apiDelete(`/alerts/remove/${ticker}`);
      setAlerts((prev) => prev.filter((a) => a.ticker !== ticker));
    } catch (e) { console.error(e); }
  };

  const getLivePrice = (ticker: string): number | undefined =>
    prices?.[ticker] ?? prices?.[`${ticker}.NS`];

  const watching  = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);
  const displayed = activeTab === "watching" ? watching : triggered;

  return (
    <>
      <ParticleCanvas />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111111; overflow-x: clip; }

        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes shimmer  { from { background-position:200% 0; } to { background-position:-200% 0; } }
        @keyframes fade-up  { from { opacity:0; transform:translateY(8px);  } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-d  { 0%,100%{opacity:1;}50%{opacity:.35;} }
        @keyframes slide-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }

        .skel { background: linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%); background-size:400% 100%; animation:shimmer 1.5s infinite; }
        .fade-up  { animation: fade-up  .35s ease-out both; }
        .slide-in { animation: slide-in .2s  ease-out both; }
        .live-dot { width:6px; height:6px; border-radius:50%; background:${UP}; display:inline-block; animation:pulse-d 1.8s ease-in-out infinite; }

        .alert-row { display:flex; justify-content:space-between; align-items:flex-start; padding:14px 16px; border-bottom:0.5px solid ${BDR}; transition:background .15s; }
        .alert-row:last-child { border-bottom:none; }
        .alert-row:hover { background:rgba(255,255,255,0.02); }

        .tab-btn {
          display:flex; align-items:center; gap:7px;
          padding:8px 16px; border-radius:8px;
          font-size:12px; font-weight:500;
          font-family:'DM Sans', sans-serif;
          cursor:pointer; transition:all .15s;
          border:0.5px solid transparent;
        }

        .refresh-btn {
          display:flex; align-items:center; gap:7px;
          padding:8px 16px; border-radius:8px;
          background:transparent; border:0.5px solid ${BDR};
          color:${T3}; font-size:12px; font-weight:500;
          font-family:'DM Sans', sans-serif;
          cursor:pointer; transition:all .15s; white-space:nowrap;
        }
        .refresh-btn:hover { border-color:${T2}; color:${T2}; }

        .new-alert-btn {
          display:flex; align-items:center; gap:7px;
          padding:8px 18px; border-radius:8px;
          font-size:12px; font-weight:500; letter-spacing:0.02em;
          font-family:'DM Sans', sans-serif;
          cursor:pointer; transition:all .15s; white-space:nowrap;
          background:rgba(255,255,255,0.07);
          border:0.5px solid rgba(255,255,255,0.12);
          color:${T1};
        }
        .new-alert-btn:hover { background:rgba(255,255,255,0.10); border-color:rgba(255,255,255,0.20); }
        .new-alert-btn.cancel { background:rgba(255,255,255,0.04); border-color:${BDR}; color:${T3}; }
        .new-alert-btn.cancel:hover { color:${T2}; border-color:rgba(255,255,255,0.15); }

        .field-input {
          background:rgba(255,255,255,0.04); border:0.5px solid ${BDR};
          border-radius:8px; padding:10px 12px;
          font-size:13px; color:${T1}; width:100%;
          font-family:'DM Sans', sans-serif;
          outline:none; transition:border-color .15s;
        }
        .field-input::placeholder { color:${T3}; }
        .field-input:focus { border-color:rgba(255,255,255,0.18); }

        .cond-btn {
          flex:1; font-size:12px; font-weight:500; font-family:'DM Sans',sans-serif;
          background:transparent; border:none; cursor:pointer; transition:all .15s; padding:0;
        }

        .submit-btn {
          padding:10px 20px; border-radius:8px;
          font-size:13px; font-weight:500; letter-spacing:0.02em;
          font-family:'DM Sans', sans-serif;
          cursor:pointer; transition:all .15s;
          background:rgba(255,255,255,0.07);
          border:0.5px solid rgba(255,255,255,0.12);
          color:${T1};
        }
        .submit-btn:hover:not(:disabled) { background:rgba(255,255,255,0.10); border-color:rgba(255,255,255,0.20); }
        .submit-btn:disabled { opacity:0.35; cursor:not-allowed; }

        .delete-btn {
          font-size:11px; padding:3px 7px; border-radius:6px;
          background:transparent; border:0.5px solid transparent;
          color:${T3}; font-family:'DM Sans',sans-serif;
          cursor:pointer; transition:all .15s;
        }
        .delete-btn:hover { color:${DN}; border-color:rgba(224,85,85,0.3); background:rgba(224,85,85,0.07); }

        @media (max-width: 768px) {
          .al-header    { flex-direction:column !important; align-items:flex-start !important; }
          .al-form-grid { grid-template-columns:1fr !important; }
        }
      `}</style>

      <div style={{
        position: "relative", zIndex: 4,
        minHeight: "100vh", padding: "20px 24px",
        fontFamily: "'DM Sans', sans-serif",
        color: T1,
        display: "flex", flexDirection: "column", gap: 12,
      }}>

        {/* ── HEADER ── */}
        <div className="al-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>
                Price Alerts
              </h1>
              <MarketBadge status={marketStatus} />
              {isMarketLive && (
                <Badge color={connected ? "up" : "amb"}>
                  {connected ? "⚡ Live" : "⟳ Connecting…"}
                </Badge>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <p style={{ fontSize:12, color:T3 }}>Monitor stocks and get notified when targets are hit</p>
              {lastUpdated && (
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T3 }}>
                  <FiRefreshCw size={11} style={{ animation: fetching ? "spin .7s linear infinite" : "none", color: fetching ? UP : T3 }} />
                  {lastUpdated.toLocaleTimeString("en-IN")}
                </div>
              )}
            </div>
          </div>

          <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
            <button className="refresh-btn" onClick={() => fetchAlerts(true)}>
              <FiRefreshCw size={12} style={{ animation: fetching ? "spin .7s linear infinite" : "none" }} />
              Refresh
            </button>
            <button className={`new-alert-btn${formOpen ? " cancel" : ""}`} onClick={() => setFormOpen((v) => !v)}>
              {formOpen ? "✕ Cancel" : "+ New Alert"}
            </button>
          </div>
        </div>

        <MarketClosedBanner status={marketStatus} />
              <PushNotificationToggle />
        {/* ── CREATE FORM ── */}
        {formOpen && (
          <Card className="slide-in" style={{ overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
              <SectionLabel>Create Price Alert</SectionLabel>
            </div>

            <div style={{ padding:"16px" }}>
              <div className="al-form-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>

                {/* Symbol */}
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase" }}>Symbol</div>
                  <input
                    className="field-input"
                    placeholder="e.g. RELIANCE"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                    style={{ textTransform:"uppercase", letterSpacing:"0.05em" }}
                  />
                  {tickerInput && getLivePrice(tickerInput) && (
                    <span style={{ fontSize:11, color:T3 }}>
                      Live: <span style={{ color:UP }}>{formatINR(getLivePrice(tickerInput))}</span>
                    </span>
                  )}
                </div>

                {/* Condition */}
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase" }}>Condition</div>
                  <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:`0.5px solid ${BDR}`, height:42 }}>
                    {(["above", "below"] as const).map((c) => (
                      <button key={c} className="cond-btn"
                        onClick={() => setCondition(c)}
                        style={{
                          color:      condition === c ? (c === "above" ? UP : DN) : T3,
                          background: condition === c ? (c === "above" ? UP_BG : DN_BG) : "transparent",
                          borderRight: c === "above" ? `0.5px solid ${BDR}` : "none",
                        }}>
                        {c === "above" ? "▲ Above" : "▼ Below"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Price */}
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase" }}>Target Price (₹)</div>
                  <input
                    className="field-input"
                    type="number"
                    placeholder="0.00"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                  />
                  {tickerInput && targetPrice && getLivePrice(tickerInput) && (
                    <span style={{ fontSize:11, color:distanceColor(getLivePrice(tickerInput), parseFloat(targetPrice), condition) }}>
                      Distance: {distanceLabel(getLivePrice(tickerInput), parseFloat(targetPrice))}
                    </span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop:`0.5px solid ${BDR}`, marginBottom:12 }} />

              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                {createError ? (
                  <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:DN, background:DN_BG, border:`0.5px solid ${DN_BDR}`, borderRadius:8, padding:"7px 12px" }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:DN, flexShrink:0 }} />
                    {createError}
                  </div>
                ) : <span />}
                <button
                  className="submit-btn"
                  onClick={handleCreate}
                  disabled={creating || !tickerInput || !targetPrice}
                >
                  {creating ? "Creating…" : "Create Alert"}
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* ── TABS ── */}
        <div style={{ display:"flex", gap:6 }}>
          {(["watching", "triggered"] as const).map((tab) => {
            const active = activeTab === tab;
            const count  = tab === "watching" ? watching.length : triggered.length;
            return (
              <button key={tab} className="tab-btn"
                onClick={() => setActiveTab(tab)}
                style={{
                  background:  active ? "rgba(255,255,255,0.06)" : "transparent",
                  borderColor: active ? BDR : "transparent",
                  color:       active ? T1 : T2,
                }}>
                {tab === "watching" ? "Watching" : "Triggered"}
                <span style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:20, background:"rgba(255,255,255,0.07)", color:T3 }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── ALERT LIST ── */}
      {loading ? (
  <PageLoader message="Loading alerts…" />
        ) : displayed.length === 0 ? (
          <Card className="fade-up" style={{ padding:"48px 24px", textAlign:"center" }}>
            <div style={{ fontSize:13, color:T3 }}>
              {activeTab === "watching" ? "No active alerts — create one above." : "No alerts have triggered yet."}
            </div>
          </Card>
        ) : (
          <Card className="fade-up" style={{ overflow:"hidden" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
              <SectionLabel>{activeTab === "watching" ? "Watching" : "Triggered"}</SectionLabel>
              {isMarketLive && connected && activeTab === "watching" && (
                <span className="live-dot" />
              )}
            </div>

            <div>
              {displayed.map((alert, i) => {
                const livePrice   = getLivePrice(alert.ticker) ?? alert.current_price ?? null;
                const dist        = distanceLabel(livePrice, alert.target_price);
                const distColor   = distanceColor(livePrice, alert.target_price, alert.condition);
                const almostThere = livePrice != null && alert.target_price != null
                  ? alert.condition === "above"
                    ? livePrice >= alert.target_price * 0.98
                    : livePrice <= alert.target_price * 1.02
                  : false;

                const rowBg = alert.triggered
                  ? "rgba(61,186,106,0.03)"
                  : almostThere
                  ? "rgba(196,148,58,0.04)"
                  : "transparent";

                return (
                  <div key={`${alert.ticker}-${alert.condition}-${i}`}
                    className="alert-row"
                    style={{ background: rowBg }}>

                    {/* Left */}
                    <div style={{ flex:1, minWidth:0, marginRight:16 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                        <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:16, color:T1, letterSpacing:"-0.01em" }}>
                          {alert.ticker}
                        </span>
                        {isMarketLive && connected && !alert.triggered && (
                          <span style={{ width:5, height:5, borderRadius:"50%", background: almostThere ? AMB : UP, display:"inline-block", animation:"pulse-d 1.8s ease-in-out infinite", flexShrink:0 }} />
                        )}
                        {alert.triggered && <Badge color="up">✓ Triggered</Badge>}
                        {almostThere && !alert.triggered && <Badge color="amb">⚡ Near target</Badge>}
                      </div>

                      <span style={{
                        display:"inline-flex", alignItems:"center", gap:4,
                        fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20,
                        background: alert.condition === "above" ? UP_BG : DN_BG,
                        border: `0.5px solid ${alert.condition === "above" ? UP_BDR : DN_BDR}`,
                        color: alert.condition === "above" ? UP : DN,
                        letterSpacing:"0.04em",
                      }}>
                        {alert.condition === "above" ? "▲ Above" : "▼ Below"} {formatINR(alert.target_price)}
                      </span>
                    </div>

                    {/* Right */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                      {livePrice != null ? (
                        <>
                          <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>
                            {formatINR(livePrice)}
                          </span>
                          {!alert.triggered && (
                            <span style={{ fontSize:11, fontWeight:500, color:distColor }}>{dist} to target</span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:T3 }}>—</span>
                      )}

                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                        <span style={{ fontSize:11, color:T3 }}>
                          {alert.triggered && alert.triggered_ts ? timeAgo(alert.triggered_ts) : timeAgo(alert.created_at)}
                        </span>
                        {!alert.triggered && (
                          <button className="delete-btn" onClick={() => handleDelete(alert.ticker)} title="Remove alert">✕</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── FOOTER ── */}
        {!loading && marketStatus && (
          <div style={{ textAlign:"center", fontSize:11, color:T3, paddingBottom:4 }}>
            {marketStatus.is_live
              ? connected
                ? "⚡ Prices streaming live · Alerts refresh every 30s"
                : "Reconnecting to live feed…"
              : `Market closed · Opens ${marketStatus.market_open} IST weekdays`}
          </div>
        )}

      </div>
    </>
  );
}