"use client";

import { useEffect, useState, useCallback } from "react";
import { FiPlus, FiTrash2, FiRefreshCw, FiX } from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge, MarketClosedBanner, PriceCell } from "@/hooks/MarketUI";
import { useLivePrices }   from "@/hooks/useLivePrices";
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
const AMB_BG = "rgba(196,148,58,0.08)";
const AMB_BDR= "rgba(196,148,58,0.20)";
const AMB    = "#c4943a";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Transaction { _id: string; symbol: string; type: "buy"|"sell"; quantity: number; price: number; date: string; }
interface Position    { symbol: string; quantity: number; avg_cost: number; live_price: number; current_value: number; invested: number; unrealized_pnl: number; percent_change: number; }
interface Summary     { total_invested: number; current_value: number; realized_pnl: number; unrealized_pnl: number; total_pnl: number; }

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ─── Shared components ─────────────────────────────────────────── */
function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ background: CARD, border: `0.5px solid ${BDR}`, borderRadius: 12, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", color: T3, textTransform: "uppercase", ...style }}>{children}</div>;
}

function Badge({ children, color = "neu" }: { children: React.ReactNode; color?: "up"|"dn"|"amb"|"neu" }) {
  const bg  = color==="up"?UP_BG  : color==="dn"?DN_BG  : color==="amb"?AMB_BG  : "rgba(255,255,255,0.05)";
  const bdr = color==="up"?UP_BDR : color==="dn"?DN_BDR : color==="amb"?AMB_BDR : BDR;
  const cl  = color==="up"?UP     : color==="dn"?DN     : color==="amb"?AMB     : T3;
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, background:bg, border:`0.5px solid ${bdr}`, color:cl, letterSpacing:"0.04em" }}>{children}</span>;
}

/* ════════════════════════════════════════════════════════════════ */
export default function TransactionsPage() {
  const marketStatus = useMarketStatus();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [positions,    setPositions]    = useState<Position[]>([]);
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [fetching,     setFetching]     = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [activeTab,    setActiveTab]    = useState<"positions"|"history">("positions");

  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState({ symbol: "", type: "buy", quantity: "", date: "" });
  const [livePrice,    setLivePrice]    = useState<number | null>(null);
  const [priceStatus,  setPriceStatus]  = useState<"idle"|"loading"|"found"|"error">("idle");
  const [submitting,   setSubmitting]   = useState(false);

  const token = typeof window !== "undefined"
    ? (localStorage.getItem("token") || localStorage.getItem("access_token"))
    : null;

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setFetching(true);
    try {
      const res  = await fetch(`${API}/transactions/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setTransactions(data.transactions || []);
      setPositions(data.open_positions || []);
      setSummary(data.summary || null);
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setFetching(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, []);

  const { prices, prevPrices, connected } = useLivePrices(positions.map(p => p.symbol), !!marketStatus?.is_live);

  const livePositions = positions.map(p => {
    const lp  = prices[p.symbol] ?? p.live_price;
    const cv  = p.quantity * lp;
    const pnl = cv - p.invested;
    const pct = p.invested > 0 ? (pnl / p.invested) * 100 : 0;
    return { ...p, live_price: lp, current_value: round2(cv), unrealized_pnl: round2(pnl), percent_change: round2(pct) };
  });

  /* Live price debounce for modal */
  useEffect(() => {
    if (!form.symbol || form.symbol.length < 2) { setLivePrice(null); setPriceStatus("idle"); return; }
    setPriceStatus("loading");
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/transactions/live-price/${form.symbol}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.live_price) { setLivePrice(data.live_price); setPriceStatus("found"); }
        else { setLivePrice(null); setPriceStatus("error"); }
      } catch { setLivePrice(null); setPriceStatus("error"); }
    }, 600);
    return () => clearTimeout(t);
  }, [form.symbol, token]);

  const handleAdd = async () => {
    if (!form.symbol || !form.quantity || !form.date || !livePrice) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/transactions/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol: form.symbol, type: form.type, quantity: parseFloat(form.quantity), date: form.date }),
      });
      setShowModal(false);
      setForm({ symbol: "", type: "buy", quantity: "", date: "" });
      setLivePrice(null); setPriceStatus("idle");
      fetchData();
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`${API}/transactions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  /* Derived summary with live prices */
  const liveTotalInvested = livePositions.reduce((s, p) => s + p.invested, 0);
  const liveTotalValue    = livePositions.reduce((s, p) => s + p.current_value, 0);
  const liveUnrealizedPnl = liveTotalValue - liveTotalInvested;
  const liveTotalPnl      = (summary?.realized_pnl ?? 0) + liveUnrealizedPnl;
  const liveSummary = summary ? { ...summary, current_value: round2(liveTotalValue), unrealized_pnl: round2(liveUnrealizedPnl), total_pnl: round2(liveTotalPnl) } : null;

  const canSubmit      = priceStatus === "found" && form.quantity && form.date && !submitting;
  const estimatedTotal = livePrice && form.quantity ? livePrice * parseFloat(form.quantity) : null;

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
        @keyframes slide-up{ from { transform:translateY(100%); } to { transform:translateY(0); } }

        .fade-up  { animation: fade-up .35s ease-out both; }
        .live-dot { width:6px; height:6px; border-radius:50%; background:${UP}; display:inline-block; animation:pulse-d 1.8s ease-in-out infinite; }

        /* Table styles */
        .tx-table { width:100%; border-collapse:collapse; font-family:'DM Sans',sans-serif; }
        .tx-table th { text-align:left; padding:10px 16px; font-size:10px; font-weight:500; letter-spacing:0.07em; color:${T3}; text-transform:uppercase; border-bottom:0.5px solid ${BDR}; }
        .tx-table td { padding:12px 16px; font-size:13px; color:${T2}; border-bottom:0.5px solid ${BDR}; vertical-align:middle; }
        .tx-table tr:last-child td { border-bottom:none; }
        .tx-table tbody tr { transition:background .15s; }
        .tx-table tbody tr:hover { background:rgba(255,255,255,0.02); }

        /* Tab */
        .tx-tab { padding:10px 20px; font-size:13px; font-family:'DM Sans',sans-serif; cursor:pointer; border:none; background:transparent; color:${T3}; border-bottom:1.5px solid transparent; transition:color .15s,border-color .15s; }
        .tx-tab.active { color:${T1}; border-bottom-color:${T1}; }
        .tx-tab:hover:not(.active) { color:${T2}; }

        /* Modal input */
        .tx-input {
          width:100%; padding:10px 14px; background:${SURF}; border:0.5px solid ${BDR};
          border-radius:8px; font-size:13px; color:${T1}; font-family:'DM Sans',sans-serif; outline:none;
          transition:border-color .2s;
        }
        .tx-input::placeholder { color:${T3}; }
        .tx-input:focus { border-color:${T2}; }
        .tx-input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); }

        /* Buttons */
        .tx-btn-primary { display:flex; align-items:center; justify-content:center; gap:7px; padding:10px 20px; border-radius:8px; background:${T1}; color:${BG}; border:none; font-size:13px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; transition:opacity .15s,transform .15s; }
        .tx-btn-primary:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
        .tx-btn-primary:disabled { opacity:.4; cursor:not-allowed; }

        .tx-btn-ghost { display:flex; align-items:center; justify-content:center; gap:7px; padding:9px 16px; border-radius:8px; background:transparent; color:${T2}; border:0.5px solid ${BDR}; font-size:13px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:border-color .15s,color .15s; }
        .tx-btn-ghost:hover { border-color:${T2}; color:${T1}; }

        .del-btn { background:none; border:none; cursor:pointer; color:${T3}; padding:5px; border-radius:5px; transition:color .15s; display:flex; align-items:center; }
        .del-btn:hover { color:${DN}; }

        @media (max-width:768px) {
          .tx-desktop { display:none !important; }
          .tx-header  { flex-direction:column !important; align-items:flex-start !important; }
          .tx-summary { grid-template-columns:1fr 1fr !important; }
          .modal-inner { animation:slide-up .25s ease-out; border-radius:16px 16px 0 0 !important; }
        }
        @media (min-width:769px) {
          .tx-mobile { display:none !important; }
        }
      `}</style>

      <div style={{ position:"relative", zIndex:4, minHeight:"100vh", padding:"20px 24px", fontFamily:"'DM Sans',sans-serif", color:T1, display:"flex", flexDirection:"column", gap:12 }}>

        {/* ── HEADER ── */}
        <div className="tx-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>Transactions</h1>
              <MarketBadge status={marketStatus} />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <p style={{ fontSize:12, color:T3 }}>Live prices via Angel One SmartAPI</p>
              {lastUpdated && (
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T3 }}>
                  <FiRefreshCw size={11} style={{ animation:fetching?"spin .7s linear infinite":"none", color:fetching?UP:T3 }}/>
                  Updated {lastUpdated.toLocaleTimeString("en-IN")}
                </div>
              )}
            </div>
          </div>
          <button className="tx-btn-primary" style={{ flexShrink:0 }} onClick={() => setShowModal(true)}>
            <FiPlus size={13}/> Add Transaction
          </button>
        </div>

        <MarketClosedBanner status={marketStatus} />

        {/* ── SUMMARY CARDS ── */}
        {liveSummary && (
          <div className="tx-summary fade-up" style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
            {[
              { label:"Invested",      value:liveSummary.total_invested,  pnl:false },
              { label:"Current Value", value:liveSummary.current_value,   pnl:false },
              { label:"Realized P&L",  value:liveSummary.realized_pnl,    pnl:true  },
              { label:"Unrealized",    value:liveSummary.unrealized_pnl,  pnl:true  },
              { label:"Total P&L",     value:liveSummary.total_pnl,       pnl:true  },
            ].map((card, i) => {
              const up  = card.value >= 0;
              const bg  = card.pnl ? (up ? UP_BG  : DN_BG)  : CARD;
              const bdr = card.pnl ? (up ? UP_BDR : DN_BDR) : BDR;
              const cl  = card.pnl ? (up ? UP     : DN)     : T1;
              return (
                <div key={i} style={{ background:bg, border:`0.5px solid ${bdr}`, borderRadius:12, padding:"14px 16px", backdropFilter:"blur(10px)" }}>
                  <SectionLabel style={{ marginBottom:8 }}>{card.label}</SectionLabel>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(14px,2vw,18px)", color:cl, letterSpacing:"-0.02em", lineHeight:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {card.pnl && card.value >= 0 ? "+" : ""}{fmt(card.value)}
                  </div>
                  {card.label === "Current Value" && marketStatus?.is_live && (
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:5 }}>
                      <span className="live-dot"/>
                      <span style={{ fontSize:10, color:UP }}>Live</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TABS + TABLE ── */}
        <Card style={{ overflow:"hidden" }}>
          {/* Tab bar */}
          <div style={{ display:"flex", borderBottom:`0.5px solid ${BDR}`, padding:"0 4px" }}>
            {(["positions","history"] as const).map(tab => (
              <button key={tab} className={`tx-tab${activeTab===tab?" active":""}`} onClick={() => setActiveTab(tab)}>
                {tab === "positions" ? "Open Positions" : "Trade History"}
              </button>
            ))}
            {marketStatus?.is_live && connected && (
              <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5, paddingRight:16 }}>
                <span className="live-dot"/>
                <span style={{ fontSize:11, color:UP }}>Live</span>
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"48px 0", gap:10 }}>
              <div style={{ width:24, height:24, border:`2px solid rgba(61,186,106,0.2)`, borderTopColor:UP, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
              <div style={{ fontSize:12, color:T3 }}>Loading…</div>
            </div>
          ) : activeTab === "positions" ? (
            livePositions.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", fontSize:13, color:T3 }}>No open positions</div>
            ) : (
              <>
                {/* Desktop */}
                <div className="tx-desktop" style={{ overflowX:"auto" }}>
                  <table className="tx-table">
                    <thead>
                      <tr>
                        {["Symbol","Qty","Avg Cost","Live Price","Current Value","Unrealized P&L","Change"].map(h=>(
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {livePositions.map(p => {
                        const up = p.unrealized_pnl >= 0;
                        return (
                          <tr key={p.symbol}>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ fontWeight:500, color:UP }}>{p.symbol}</span>
                                {marketStatus?.is_live && <span className="live-dot"/>}
                              </div>
                            </td>
                            <td>{p.quantity}</td>
                            <td style={{ color:T3 }}>{fmt(p.avg_cost)}</td>
                            <td style={{ color:T1, fontWeight:500 }}><PriceCell value={p.live_price} prevValue={prevPrices[p.symbol]}/></td>
                            <td style={{ color:T1 }}>{fmt(p.current_value)}</td>
                            <td style={{ color:up?UP:DN, fontWeight:500 }}>{up?"+":""}{fmt(p.unrealized_pnl)}</td>
                            <td>
                              <Badge color={up?"up":"dn"}>
                                {up?"▲":"▼"} {p.percent_change?.toFixed(2)}%
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="tx-mobile" style={{ display:"flex", flexDirection:"column" }}>
                  {livePositions.map(p => {
                    const up = p.unrealized_pnl >= 0;
                    return (
                      <div key={p.symbol} style={{ padding:"14px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:14, fontWeight:500, color:UP }}>{p.symbol}</span>
                            {marketStatus?.is_live && <span className="live-dot"/>}
                          </div>
                          <Badge color={up?"up":"dn"}>{up?"▲":"▼"} {p.percent_change?.toFixed(2)}%</Badge>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                          {[
                            { label:"Live Price", value:<PriceCell value={p.live_price} prevValue={prevPrices[p.symbol]}/> },
                            { label:"Avg Cost",   value:<span style={{ color:T3 }}>{fmt(p.avg_cost)}</span> },
                            { label:"Qty",        value:<span style={{ color:T2 }}>{p.quantity}</span> },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <div style={{ fontSize:10, color:T3, letterSpacing:"0.05em", marginBottom:3 }}>{label.toUpperCase()}</div>
                              <div style={{ fontSize:12 }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                          <div style={{ background:up?UP_BG:DN_BG, border:`0.5px solid ${up?UP_BDR:DN_BDR}`, borderRadius:8, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, color:T3, letterSpacing:"0.05em", marginBottom:4 }}>UNREALIZED P&L</div>
                            <div style={{ fontSize:13, fontWeight:500, color:up?UP:DN }}>{up?"+":""}{fmt(p.unrealized_pnl)}</div>
                          </div>
                          <div style={{ background:SURF, border:`0.5px solid ${BDR}`, borderRadius:8, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, color:T3, letterSpacing:"0.05em", marginBottom:4 }}>CURRENT VALUE</div>
                            <div style={{ fontSize:13, fontWeight:500, color:T1 }}>{fmt(p.current_value)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            transactions.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", fontSize:13, color:T3 }}>No transactions yet</div>
            ) : (
              <>
                {/* Desktop */}
                <div className="tx-desktop" style={{ overflowX:"auto" }}>
                  <table className="tx-table">
                    <thead>
                      <tr>
                        {["Symbol","Type","Qty","Price at Trade","Total Value","Date",""].map(h=>(
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t._id}>
                          <td style={{ fontWeight:500, color:UP }}>{t.symbol}</td>
                          <td><Badge color={t.type==="buy"?"up":"dn"}>{t.type.toUpperCase()}</Badge></td>
                          <td>{t.quantity}</td>
                          <td style={{ color:T1 }}>{fmt(t.price)}</td>
                          <td style={{ color:T2 }}>{fmt(t.quantity * t.price)}</td>
                          <td style={{ color:T3 }}>{t.date}</td>
                          <td>
                            <button className="del-btn" onClick={() => handleDelete(t._id)}>
                              <FiTrash2 size={13}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="tx-mobile" style={{ display:"flex", flexDirection:"column" }}>
                  {transactions.map(t => (
                    <div key={t._id} style={{ padding:"14px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                            <span style={{ fontSize:13, fontWeight:500, color:UP }}>{t.symbol}</span>
                            <Badge color={t.type==="buy"?"up":"dn"}>{t.type.toUpperCase()}</Badge>
                          </div>
                          <div style={{ fontSize:11, color:T3 }}>{t.date}</div>
                        </div>
                        <button className="del-btn" onClick={() => handleDelete(t._id)}><FiTrash2 size={13}/></button>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                        {[
                          { label:"Qty",   value:t.quantity },
                          { label:"Price", value:fmt(t.price) },
                          { label:"Total", value:fmt(t.quantity * t.price) },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize:10, color:T3, letterSpacing:"0.05em", marginBottom:3 }}>{label.toUpperCase()}</div>
                            <div style={{ fontSize:12, color:T2 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          )}
        </Card>

        {/* ── FOOTER ── */}
        {marketStatus && (
          <div style={{ textAlign:"center", fontSize:11, color:T3, paddingBottom:4 }}>
            {marketStatus.is_live
              ? connected ? "⚡ Streaming live prices · NSE/BSE via Angel One WebSocket" : "Reconnecting to live feed…"
              : `Market closed · Opens ${marketStatus.market_open} IST weekdays`}
          </div>
        )}
      </div>

      {/* ── ADD TRANSACTION MODAL ── */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:200, backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
        >
          {/* On md+: center vertically */}
          <div
            className="modal-inner"
            style={{ background:CARD, border:`0.5px solid ${BDR}`, borderRadius:"12px 12px 0 0", width:"100%", maxWidth:480, padding:"24px", maxHeight:"92vh", overflowY:"auto", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)" }}
          >
            {/* Modal header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:T1, letterSpacing:"-0.02em" }}>Add Transaction</h2>
              <button onClick={() => setShowModal(false)} style={{ background:"none", border:"none", color:T3, cursor:"pointer", padding:4, borderRadius:6, display:"flex", alignItems:"center", transition:"color .15s" }}
                onMouseEnter={e => (e.currentTarget.style.color=T2)} onMouseLeave={e => (e.currentTarget.style.color=T3)}>
                <FiX size={18}/>
              </button>
            </div>

            {/* Symbol */}
            <div style={{ marginBottom:14 }}>
              <SectionLabel style={{ marginBottom:6 }}>Stock Symbol (NSE / BSE)</SectionLabel>
              <input
                className="tx-input"
                placeholder="e.g. RELIANCE, TCS, INFY"
                value={form.symbol}
                onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                style={{ textTransform:"uppercase", letterSpacing:"0.05em" }}
              />
            </div>

            {/* Live price pill */}
            <div style={{
              marginBottom:14, padding:"12px 14px", borderRadius:8,
              background: priceStatus==="found" ? UP_BG : SURF,
              border: `0.5px solid ${priceStatus==="found" ? UP_BDR : BDR}`,
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <div>
                <SectionLabel style={{ marginBottom:5 }}>Live Market Price</SectionLabel>
                {priceStatus==="idle"    && <div style={{ fontSize:13, color:T3 }}>Enter a symbol above</div>}
                {priceStatus==="loading" && <div style={{ fontSize:13, color:T3 }}>Fetching price…</div>}
                {priceStatus==="found"   && <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:UP, letterSpacing:"-0.02em" }}>₹{livePrice?.toLocaleString("en-IN",{ minimumFractionDigits:2 })}</div>}
                {priceStatus==="error"   && <div style={{ fontSize:13, color:DN }}>Symbol not found on NSE/BSE</div>}
              </div>
              {priceStatus==="found" && <Badge color="neu">Angel One</Badge>}
            </div>

            {/* Type toggle */}
            <div style={{ marginBottom:14 }}>
              <SectionLabel style={{ marginBottom:6 }}>Transaction Type</SectionLabel>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {(["buy","sell"] as const).map(type => (
                  <button key={type} onClick={() => setForm({ ...form, type })}
                    style={{
                      padding:"10px", borderRadius:8, border:`0.5px solid ${form.type===type ? (type==="buy"?UP_BDR:DN_BDR) : BDR}`,
                      background: form.type===type ? (type==="buy"?UP_BG:DN_BG) : "transparent",
                      color: form.type===type ? (type==="buy"?UP:DN) : T3,
                      fontSize:13, fontWeight:500, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", transition:"all .15s",
                    }}>
                    {type === "buy" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div style={{ marginBottom:14 }}>
              <SectionLabel style={{ marginBottom:6 }}>Quantity</SectionLabel>
              <input
                className="tx-input" type="number" placeholder="Number of shares" min="1"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
              />
            </div>

            {/* Estimated total */}
            {estimatedTotal && (
              <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:8, background:SURF, border:`0.5px solid ${BDR}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:12, color:T3 }}>Estimated total</span>
                <span style={{ fontSize:13, fontWeight:500, color:T1 }}>₹{estimatedTotal.toLocaleString("en-IN",{ minimumFractionDigits:2 })}</span>
              </div>
            )}

            {/* Date */}
            <div style={{ marginBottom:20 }}>
              <SectionLabel style={{ marginBottom:6 }}>Trade Date</SectionLabel>
              <input
                className="tx-input" type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {/* Actions */}
            <div style={{ display:"flex", gap:8 }}>
              <button className="tx-btn-ghost" style={{ flex:1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="tx-btn-primary"
                style={{ flex:1, opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed" }}
                disabled={!canSubmit}
                onClick={handleAdd}
              >
                {submitting ? "Placing…" : `Confirm ${form.type === "buy" ? "Buy" : "Sell"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}