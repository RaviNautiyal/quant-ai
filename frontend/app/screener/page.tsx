"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiRefreshCw, FiZap } from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge, MarketClosedBanner } from "@/hooks/MarketUI";
import { apiFetch, apiPost, ApiError } from "@/lib/apiFetch";
import ParticleCanvas from "@/components/ParticleCanvas";

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

const SECTORS = ["any","Banking","IT","Energy","Pharma","Auto","FMCG","Metals","Infrastructure","NBFC","Telecom","Power","Cement","Paint","Consumer","Healthcare","Conglomerate","Diversified"];
const RISKS   = ["any","Low","Medium","High"];
const TRENDS  = ["any","Upward","Downward"];
const NSE_UNIVERSE_COUNT = 42;

interface Stock {
  ticker:        string;
  name:          string;
  sector:        string;
  price:         number;
  change_1mo:    number;
  volume:        number;
  vol_expanding: boolean;
  volatility:    number;
  trend:         string;
  risk:          string;
  rsi:           number | null;
  ema_status:    string;
  above_50ema:   boolean;
  above_200ema:  boolean;
  golden_cross:  boolean;
  pe_ratio:      number;
  roe:           number;
  debt_equity:   number;
  market_cap:    number;
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

function MarkdownText({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {text.split("\n").map((line, i) => {
        const fmt = line.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${T1}">$1</strong>`);
        if (/^[📊📈🎯🧠⚠️🔥💡]/.test(line)) return (
          <p key={i} style={{ fontWeight: 600, color: T2, marginTop: 12, fontSize: 12, letterSpacing: "0.02em" }}
            dangerouslySetInnerHTML={{ __html: fmt }} />
        );
        if (line.startsWith("- ")) return (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 13 }}>
            <span style={{ color: T3, flexShrink: 0, marginTop: 2 }}>·</span>
            <span style={{ color: T2, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: fmt.slice(2) }} />
          </div>
        );
        if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
        return <p key={i} style={{ fontSize: 13, color: T2, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: fmt }} />;
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function ScreenerPage() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const [stocks,     setStocks]     = useState<Stock[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [error,      setError]      = useState("");
  const [sortKey,    setSortKey]    = useState<keyof Stock>("change_1mo");
  const [sortAsc,    setSortAsc]    = useState(false);

  const [filters, setFilters] = useState({
    min_price:  0,
    max_price:  999999,
    trend:      "any",
    risk:       "any",
    sector:     "any",
    min_volume: 0,
  });

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const runScreener = async () => {
    setLoading(true); setStocks([]); setAiAnalysis(""); setError("");
    try {
      const params = new URLSearchParams({
        min_price:  filters.min_price.toString(),
        max_price:  filters.max_price.toString(),
        trend:      filters.trend,
        risk:       filters.risk,
        sector:     filters.sector,
        min_volume: filters.min_volume.toString(),
      });
      const data: Stock[] = await apiFetch(`/screener/screen?${params}`);
      setStocks(data);
      if (data.length > 0) runAiAnalysis(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not connect to server");
    }
    setLoading(false);
  };

  const runAiAnalysis = async (screenedStocks: Stock[]) => {
    setAiLoading(true);
    const top    = screenedStocks.slice(0, 20);
    const prompt = `NSE Universe scan — ${screenedStocks.length} stocks screened.\n\nTop stocks by 1M momentum:\n${top.map(s =>
      `- ${s.ticker} (${s.sector}): ₹${s.price} | ${s.change_1mo >= 0 ? "+" : ""}${s.change_1mo}% 1M | RSI ${s.rsi ?? "—"} | ${s.ema_status} | Vol expanding: ${s.vol_expanding} | Golden Cross: ${s.golden_cross} | ROE: ${s.roe}% | D/E: ${s.debt_equity}`
    ).join("\n")}\n\nIdentify high-probability setups. Apply your screening framework strictly. Max 5–8 stocks.`;
    try {
      const data = await apiPost("/ai/chat", { message: prompt, history: [] });
      setAiAnalysis(data.response || "");
    } catch { setAiAnalysis("AI analysis unavailable."); }
    setAiLoading(false);
  };

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortKey] as number, bv = b[sortKey] as number;
    return sortAsc ? av - bv : bv - av;
  });

  const toggleSort = (key: keyof Stock) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const fmt    = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const fmtCap = (n: number) => {
    if (!n) return "—";
    if (n >= 1e12) return `₹${(n / 1e12).toFixed(1)}L Cr`;
    if (n >= 1e7)  return `₹${(n / 1e7).toFixed(0)} Cr`;
    return "—";
  };

  const rsiColor = (v: number | null): string =>
    v == null ? T3 : v >= 70 ? DN : v <= 30 ? UP : v >= 55 ? "#86efac" : T2;

  const riskStyle = (r: string): React.CSSProperties =>
    r === "Low"    ? { background: UP_BG,  color: UP,  border: `0.5px solid ${UP_BDR}`  } :
    r === "Medium" ? { background: AMB_BG, color: AMB, border: `0.5px solid ${AMB_BDR}` } :
                     { background: DN_BG,  color: DN,  border: `0.5px solid ${DN_BDR}`  };

  const SortTh = ({ label, k }: { label: string; k: keyof Stock }) => (
    <th onClick={() => toggleSort(k)} style={{
      padding: "10px 14px", textAlign: "left", fontWeight: 500, fontSize: 10,
      letterSpacing: "0.07em", color: sortKey === k ? T2 : T3, textTransform: "uppercase",
      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", transition: "color .15s",
    }}>
      {label} {sortKey === k ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  const StaticTh = ({ label }: { label: string }) => (
    <th style={{
      padding: "10px 14px", textAlign: "left", fontWeight: 500, fontSize: 10,
      letterSpacing: "0.07em", color: T3, textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      {label}
    </th>
  );

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
        @keyframes pulse-d { 0%,100%{opacity:1;}50%{opacity:.35;} }

        .skel { background: linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%); background-size:400% 100%; animation:shimmer 1.5s infinite; }
        .fade-up { animation: fade-up .35s ease-out both; }
        .ai-pulse { animation: pulse-d 1.4s ease-in-out infinite; }

        .field-input {
          width:100%; background:rgba(255,255,255,0.04); border:0.5px solid ${BDR};
          border-radius:8px; padding:9px 12px;
          font-size:12px; color:${T1};
          font-family:'DM Sans', sans-serif;
          outline:none; transition:border-color .15s;
        }
        .field-input::placeholder { color:${T3}; }
        .field-input:focus { border-color:rgba(255,255,255,0.18); }

        .field-select {
          width:100%; background:rgba(255,255,255,0.04); border:0.5px solid ${BDR};
          border-radius:8px; padding:9px 12px;
          font-size:12px; color:${T1};
          font-family:'DM Sans', sans-serif;
          outline:none; transition:border-color .15s;
          appearance:none; cursor:pointer;
        }
        .field-select:focus { border-color:rgba(255,255,255,0.18); }
        .field-select option { background:#1a1a1a; color:${T1}; }

        .run-btn {
          display:flex; align-items:center; gap:8px;
          padding:10px 22px; border-radius:8px;
          font-size:13px; font-weight:500; letter-spacing:0.02em;
          font-family:'DM Sans', sans-serif;
          cursor:pointer; transition:all .15s;
          background:rgba(255,255,255,0.07);
          border:0.5px solid rgba(255,255,255,0.12);
          color:${T1};
        }
        .run-btn:hover:not(:disabled) { background:rgba(255,255,255,0.10); border-color:rgba(255,255,255,0.20); }
        .run-btn:disabled { opacity:0.35; cursor:not-allowed; }

        .stock-row { border-bottom:0.5px solid ${BDR}; transition:background .15s; cursor:pointer; }
        .stock-row:last-child { border-bottom:none; }
        .stock-row:hover { background:rgba(255,255,255,0.025); }

        .signal-pill {
          font-size:10px; font-weight:600; padding:2px 7px; border-radius:20px;
          font-family:'DM Sans', sans-serif; letter-spacing:0.03em;
          display:inline-flex; align-items:center; white-space:nowrap;
        }

        @media (max-width: 1024px) { .sc-filter-grid { grid-template-columns: repeat(3,1fr) !important; } }
        @media (max-width: 640px)  { .sc-filter-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>

      <div style={{
        position: "relative", zIndex: 4,
        minHeight: "100vh", padding: "20px 24px",
        fontFamily: "'DM Sans', sans-serif",
        color: T1,
        display: "flex", flexDirection: "column", gap: 12,
      }}>

        {/* ── HEADER ── */}
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
            <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>
              Stock Screener
            </h1>
            <MarketBadge status={marketStatus} />
          </div>
          <p style={{ fontSize:12, color:T3 }}>
            NSE/BSE universe · Angel One live prices · AI quant setup identification
          </p>
        </div>

        <MarketClosedBanner status={marketStatus} />

        {/* ── FILTERS CARD ── */}
        <Card style={{ overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
            <SectionLabel>Filters</SectionLabel>
          </div>

          <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:16 }}>
            <div className="sc-filter-grid" style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12 }}>

              {/* Number inputs */}
              {[
                { label:"Min Price (₹)", key:"min_price" },
                { label:"Max Price (₹)", key:"max_price" },
              ].map(f => (
                <div key={f.key} style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase" }}>{f.label}</div>
                  <input type="number" className="field-input"
                    value={filters[f.key as keyof typeof filters] as number}
                    onChange={e => setFilters({ ...filters, [f.key]: Number(e.target.value) })} />
                </div>
              ))}

              {/* Select inputs */}
              {[
                { label:"Sector",     key:"sector", options:SECTORS, fmt:(s:string)=>s==="any"?"Any Sector":s },
                { label:"Trend",      key:"trend",  options:TRENDS,  fmt:(s:string)=>s==="any"?"Any Trend" :s },
                { label:"Risk Level", key:"risk",   options:RISKS,   fmt:(s:string)=>s==="any"?"Any Risk"  :s },
              ].map(f => (
                <div key={f.key} style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase" }}>{f.label}</div>
                  <select className="field-select"
                    value={filters[f.key as keyof typeof filters] as string}
                    onChange={e => setFilters({ ...filters, [f.key]: e.target.value })}>
                    {f.options.map(o => <option key={o} value={o}>{f.fmt(o)}</option>)}
                  </select>
                </div>
              ))}

              {/* Min Volume */}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase" }}>Min Volume</div>
                <input type="number" className="field-input"
                  value={filters.min_volume}
                  onChange={e => setFilters({ ...filters, min_volume: Number(e.target.value) })} />
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop:`0.5px solid ${BDR}` }} />

            {/* Run row */}
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <button className="run-btn" onClick={runScreener} disabled={loading}>
                <FiRefreshCw size={13} style={{ animation: loading ? "spin .7s linear infinite" : "none" }} />
                {loading ? "Screening…" : "Run Screener"}
              </button>
              {loading && (
                <span style={{ fontSize:11, color:T3 }}>
                  Fetching Angel One prices + 1Y OHLCV for {NSE_UNIVERSE_COUNT} NSE stocks — takes ~30s
                </span>
              )}
              {stocks.length > 0 && !loading && (
                <span style={{ fontSize:11, color:T3 }}>{stocks.length} stocks matched your filters</span>
              )}
              {error && (
                <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:DN, background:DN_BG, border:`0.5px solid ${DN_BDR}`, borderRadius:8, padding:"7px 12px" }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:DN, flexShrink:0 }} />
                  {error}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── SPINNER ── */}
        {loading && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 0", gap:12 }}>
            <div style={{ width:28, height:28, border:`2px solid rgba(61,186,106,0.2)`, borderTopColor:UP, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
            <div style={{ fontSize:12, color:T3 }}>Running screener across {NSE_UNIVERSE_COUNT} stocks…</div>
          </div>
        )}

        {/* ── AI ANALYSIS ── */}
        {(aiAnalysis || aiLoading) && (
          <Card className="fade-up" style={{ overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
              <div style={{ width:26, height:26, borderRadius:8, background:UP_BG, border:`0.5px solid ${UP_BDR}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <FiZap size={12} style={{ color:UP }} />
              </div>
              <SectionLabel>AI Quant Setup Identification</SectionLabel>
              {aiLoading && (
                <span className="ai-pulse" style={{ fontSize:11, color:T3, marginLeft:"auto" }}>Analysing setups…</span>
              )}
            </div>
            <div style={{ padding:"16px" }}>
              {aiLoading ? (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[60,75,68,82,71,78,65,88].map((w,i) => (
                    <div key={i} className="skel" style={{ height:12, width:`${w}%`, borderRadius:6 }} />
                  ))}
                </div>
              ) : <MarkdownText text={aiAnalysis} />}
            </div>
          </Card>
        )}

        {/* ── RESULTS TABLE ── */}
        {stocks.length > 0 && (
          <Card className="fade-up" style={{ overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
              <SectionLabel>{stocks.length} Stocks Matched</SectionLabel>
              <span style={{ fontSize:11, color:T3 }}>Click column headers to sort</span>
            </div>

            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
                <thead>
                  <tr style={{ borderBottom:`0.5px solid ${BDR}`, background:"rgba(255,255,255,0.02)" }}>
                    <StaticTh label="Stock"   />
                    <StaticTh label="Sector"  />
                    <SortTh   label="Price"   k="price"      />
                    <SortTh   label="1M Chg"  k="change_1mo" />
                    <SortTh   label="RSI"     k="rsi"        />
                    <StaticTh label="EMA"     />
                    <StaticTh label="Signals" />
                    <SortTh   label="Risk"    k="volatility" />
                    <SortTh   label="ROE"     k="roe"        />
                    <SortTh   label="Mkt Cap" k="market_cap" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => (
                    <tr key={i} className="stock-row" onClick={() => router.push(`/charts?ticker=${s.ticker}`)}>

                      {/* Stock */}
                      <td style={{ padding:"11px 14px" }}>
                        <p style={{ fontFamily:"'DM Serif Display',serif", fontSize:14, color:T1, letterSpacing:"-0.01em", lineHeight:1.1 }}>{s.ticker}</p>
                        <p style={{ fontSize:11, color:T3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:110, marginTop:2 }}>{s.name}</p>
                      </td>

                      {/* Sector */}
                      <td style={{ padding:"11px 14px" }}>
                        <span style={{ fontSize:10, fontWeight:500, padding:"3px 8px", borderRadius:20, background:"rgba(255,255,255,0.05)", border:`0.5px solid ${BDR}`, color:T2, letterSpacing:"0.03em" }}>
                          {s.sector}
                        </span>
                      </td>

                      {/* Price */}
                      <td style={{ padding:"11px 14px", fontFamily:"'DM Serif Display',serif", fontSize:14, color:T1 }}>
                        {fmt(s.price)}
                      </td>

                      {/* 1M Change */}
                      <td style={{ padding:"11px 14px" }}>
                        <span className="signal-pill" style={s.change_1mo >= 0
                          ? { background:UP_BG, color:UP, border:`0.5px solid ${UP_BDR}` }
                          : { background:DN_BG, color:DN, border:`0.5px solid ${DN_BDR}` }}>
                          {s.change_1mo >= 0 ? "▲" : "▼"} {Math.abs(s.change_1mo).toFixed(1)}%
                        </span>
                      </td>

                      {/* RSI */}
                      <td style={{ padding:"11px 14px", fontFamily:"'DM Serif Display',serif", fontSize:14, color:rsiColor(s.rsi) }}>
                        {s.rsi ?? "—"}
                      </td>

                      {/* EMA Status */}
                      <td style={{ padding:"11px 14px", fontSize:11, color:T2 }}>{s.ema_status}</td>

                      {/* Signals */}
                      <td style={{ padding:"11px 14px" }}>
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {s.golden_cross && (
                            <span className="signal-pill" style={{ background:AMB_BG, color:AMB, border:`0.5px solid ${AMB_BDR}` }}>
                              Golden ✕
                            </span>
                          )}
                          {s.vol_expanding && (
                            <span className="signal-pill" style={{ background:UP_BG, color:UP, border:`0.5px solid ${UP_BDR}` }}>
                              Vol ↑
                            </span>
                          )}
                          {s.above_200ema && (
                            <span className="signal-pill" style={{ background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"0.5px solid rgba(96,165,250,0.20)" }}>
                              EMA 200
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Risk */}
                      <td style={{ padding:"11px 14px" }}>
                        <span className="signal-pill" style={riskStyle(s.risk)}>{s.risk}</span>
                      </td>

                      {/* ROE */}
                      <td style={{ padding:"11px 14px", fontFamily:"'DM Serif Display',serif", fontSize:14, color:s.roe > 15 ? UP : T2 }}>
                        {s.roe ? `${s.roe}%` : "—"}
                      </td>

                      {/* Market Cap */}
                      <td style={{ padding:"11px 14px", fontSize:12, color:T2 }}>{fmtCap(s.market_cap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && stocks.length === 0 && (
          <Card className="fade-up" style={{ padding:"60px 24px", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:14, opacity:0.3 }}>🔍</div>
            <div style={{ fontSize:14, color:T2, marginBottom:6 }}>Set filters and run the screener</div>
            <div style={{ fontSize:12, color:T3 }}>
              Screens {NSE_UNIVERSE_COUNT} NSE stocks with live Angel One data · AI identifies high-probability setups
            </div>
          </Card>
        )}

        {/* ── FOOTER ── */}
        {marketStatus && (
          <div style={{ textAlign:"center", fontSize:11, color:T3, paddingBottom:4 }}>
            {marketStatus.is_live
              ? "⚡ Live prices via Angel One · AI analysis runs after each screen"
              : `Market closed · Opens ${marketStatus.market_open} IST weekdays`}
          </div>
        )}

      </div>
    </>
  );
}