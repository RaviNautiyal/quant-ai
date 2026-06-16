"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge, MarketClosedBanner } from "@/hooks/MarketUI";
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

const COLORS   = [UP, AMB, "#60a5fa"];
const BG_ALPHA = ["rgba(61,186,106,0.06)", "rgba(196,148,58,0.06)", "rgba(96,165,250,0.06)"];
const BD_ALPHA = ["rgba(61,186,106,0.20)", "rgba(196,148,58,0.20)", "rgba(96,165,250,0.20)"];

const PRESETS = [
  "RELIANCE, TCS",
  "HDFCBANK, ICICIBANK, AXISBANK",
  "INFY, WIPRO, HCLTECH",
  "SBIN, KOTAKBANK",
  "ADANIENT, ADANIPORTS",
];

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

/* ─── Types ─────────────────────────────────────────────────────── */
type Row     = { label: string; key: string; fmt: (v: any) => any; higher: boolean; color?: boolean; };
type Section = { title: string; rows: Row[]; };

/* ════════════════════════════════════════════════════════════════ */
export default function ComparePage() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();
  const [tickers, setTickers] = useState("");
  const [data,    setData]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const getToken = () => localStorage.getItem("token") || "";

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const compare = async (t?: string) => {
    const input = (t || tickers).trim();
    if (!input) return;
    setLoading(true); setError(""); setData([]);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/comparison/compare?tickers=${encodeURIComponent(input)}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.detail || "Failed to fetch comparison data");
      } else {
        setData(await res.json());
      }
    } catch { setError("Something went wrong. Check that symbols are valid NSE tickers."); }
    setLoading(false);
  };

  const chartData = () => {
    if (!data.length) return [];
    const minLen = Math.min(...data.map(s => s.prices.length));
    return data[0].dates.slice(-minLen).map((date: string, i: number) => {
      const pt: any = { date: date.slice(5) };
      data.forEach(s => {
        const slice = s.prices.slice(-minLen);
        pt[s.ticker] = slice[0] > 0 ? +((( slice[i] - slice[0]) / slice[0]) * 100).toFixed(2) : 0;
      });
      return pt;
    });
  };

  const fmt    = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const fmtCap = (n: number) => {
    if (!n) return "—";
    if (n >= 1e12) return `₹${(n/1e12).toFixed(1)}L Cr`;
    if (n >= 1e7)  return `₹${(n/1e7).toFixed(0)} Cr`;
    return `₹${(n/1e5).toFixed(0)} L`;
  };
  const pctColor = (v: number) => v >= 0 ? UP : DN;
  const pctFmt   = (v: number) => `${v >= 0 ? "+" : ""}${v}%`;

  const rsiLabel = (v: number | null) => {
    if (v === null) return { text: "—", color: T3 };
    if (v >= 70)   return { text: `${v} Overbought`, color: DN };
    if (v <= 30)   return { text: `${v} Oversold`,   color: UP };
    return { text: `${v} Neutral`, color: T2 };
  };

  const signalStyle = (s: string): React.CSSProperties =>
    s === "BUY"
      ? { background: UP_BG,  color: UP,  border: `0.5px solid ${UP_BDR}`  }
      : s === "SELL"
      ? { background: DN_BG,  color: DN,  border: `0.5px solid ${DN_BDR}`  }
      : { background: "rgba(255,255,255,0.04)", color: T3, border: `0.5px solid ${BDR}` };

  const best = (key: string, higher = true) => {
    if (data.length < 2) return -1;
    const vals = data.map(s => s[key] ?? (higher ? -Infinity : Infinity));
    const opt  = higher ? Math.max(...vals) : Math.min(...vals);
    return vals.indexOf(opt);
  };

  const SECTIONS: Section[] = [
    {
      title: "Performance",
      rows: [
        { label: "Live Price",   key: "current_price", fmt: fmt,    higher: false },
        { label: "1W Return",    key: "change_1w",     fmt: pctFmt, higher: true, color: true },
        { label: "1M Return",    key: "change_1mo",    fmt: pctFmt, higher: true, color: true },
        { label: "3M Return",    key: "change_3mo",    fmt: pctFmt, higher: true, color: true },
        { label: "3M High",      key: "high_3mo",      fmt: fmt,    higher: true },
        { label: "3M Low",       key: "low_3mo",       fmt: fmt,    higher: false },
        { label: "52W High",     key: "52w_high",      fmt: fmt,    higher: true },
        { label: "52W Low",      key: "52w_low",       fmt: fmt,    higher: false },
        { label: "From 3M High", key: "pct_from_high", fmt: pctFmt, higher: true, color: true },
      ]
    },
    {
      title: "Technical",
      rows: [
        { label: "Trend",      key: "trend",        fmt: (v) => v,  higher: false },
        { label: "SMA Signal", key: "signal",       fmt: (v) => v,  higher: false },
        { label: "RSI (14)",   key: "rsi",          fmt: (v) => rsiLabel(v).text, higher: false },
        { label: "Volatility", key: "volatility",   fmt: (v) => `${v}%`, higher: false },
        { label: "Sharpe",     key: "sharpe_ratio", fmt: (v) => v,  higher: true },
        { label: "Beta",       key: "beta",         fmt: (v) => v || "—", higher: false },
        { label: "Avg Volume", key: "avg_volume",   fmt: (v) => v ? v.toLocaleString("en-IN") : "—", higher: true },
      ]
    },
    {
      title: "Fundamentals",
      rows: [
        { label: "P/E Ratio",      key: "pe_ratio",       fmt: (v) => v || "—", higher: false },
        { label: "P/B Ratio",      key: "pb_ratio",       fmt: (v) => v || "—", higher: false },
        { label: "EPS",            key: "eps",            fmt: (v) => v ? `₹${v}` : "—", higher: true },
        { label: "ROE",            key: "roe",            fmt: (v) => v ? `${v}%` : "—", higher: true },
        { label: "Debt/Equity",    key: "debt_equity",    fmt: (v) => v || "—", higher: false },
        { label: "Dividend Yield", key: "dividend_yield", fmt: (v) => v ? `${v}%` : "—", higher: true },
        { label: "Market Cap",     key: "market_cap",     fmt: fmtCap, higher: true },
      ]
    }
  ];

  return (
    <>
      <ParticleCanvas />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111111; overflow-x: clip; }

        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fade-up  { from { opacity:0; transform:translateY(8px);  } to { opacity:1; transform:translateY(0); } }
        @keyframes slide-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }

        .fade-up  { animation: fade-up  .35s ease-out both; }
        .slide-in { animation: slide-in .2s  ease-out both; }

        .field-input {
          background: rgba(255,255,255,0.04); border: 0.5px solid ${BDR};
          border-radius: 8px; padding: 10px 14px;
          font-size: 13px; color: ${T1};
          font-family: 'DM Sans', sans-serif;
          outline: none; transition: border-color .15s;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .field-input::placeholder { color: ${T3}; text-transform: none; letter-spacing: normal; }
        .field-input:focus { border-color: rgba(255,255,255,0.18); }

        .run-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 10px 22px; border-radius: 8px;
          font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all .15s; white-space: nowrap;
          background: rgba(255,255,255,0.07);
          border: 0.5px solid rgba(255,255,255,0.12);
          color: ${T1};
        }
        .run-btn:hover:not(:disabled) { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.20); }
        .run-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .preset-btn {
          padding: 5px 12px; border-radius: 8px;
          font-size: 11px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all .15s;
          background: rgba(255,255,255,0.04); border: 0.5px solid ${BDR}; color: ${T2};
        }
        .preset-btn:hover { color: ${T1}; border-color: rgba(255,255,255,0.15); }

        .metric-row { display:flex; align-items:center; padding:11px 16px; border-bottom:0.5px solid ${BDR}; transition:background .15s; }
        .metric-row:last-child { border-bottom: none; }
        .metric-row:hover { background: rgba(255,255,255,0.02); }

        .verdict-card { border-radius: 10px; padding: 16px; text-align: center; border: 0.5px solid ${BDR}; background: rgba(255,255,255,0.02); }

        @media (max-width: 768px) {
          .cp-header     { flex-direction: column !important; align-items: flex-start !important; }
          .cp-search-row { flex-direction: column !important; }
          .cp-search-row input { width: 100% !important; }
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
        <div className="cp-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>
                Stock Comparison
              </h1>
              <MarketBadge status={marketStatus} />
            </div>
            <p style={{ fontSize:12, color:T3 }}>Compare up to 3 NSE/BSE stocks · Angel One live data</p>
          </div>
        </div>

        <MarketClosedBanner status={marketStatus} />

        {/* ── SEARCH CARD ── */}
        <Card className="slide-in" style={{ overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
            <SectionLabel>Enter NSE Symbols · Comma Separated</SectionLabel>
          </div>

          <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:14 }}>
            {/* Input row */}
            <div className="cp-search-row" style={{ display:"flex", gap:10 }}>
              <input
                className="field-input"
                style={{ flex:1 }}
                placeholder="e.g. RELIANCE, TCS, INFY"
                value={tickers}
                onChange={e => setTickers(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && compare()}
              />
              <button className="run-btn" onClick={() => compare()} disabled={loading || !tickers}>
                {loading ? "Comparing…" : "Compare"}
              </button>
            </div>

            {/* Divider */}
            <div style={{ borderTop:`0.5px solid ${BDR}` }} />

            {/* Presets */}
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <SectionLabel>Presets</SectionLabel>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {PRESETS.map((p, i) => (
                  <button key={i} className="preset-btn" onClick={() => { setTickers(p); compare(p); }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:DN, background:DN_BG, border:`0.5px solid ${DN_BDR}`, borderRadius:8, padding:"7px 12px" }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:DN, flexShrink:0 }} />
                {error}
              </div>
            )}
          </div>
        </Card>

        {/* ── SPINNER ── */}
        {loading && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 0", gap:12 }}>
            <div style={{ width:28, height:28, border:`2px solid rgba(61,186,106,0.2)`, borderTopColor:UP, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
            <div style={{ fontSize:12, color:T3 }}>Fetching comparison data…</div>
          </div>
        )}

        {data.length > 0 && (
          <>
            {/* ── STOCK HEADER CARDS ── */}
            <div className="fade-up" style={{ display:"grid", gridTemplateColumns:`repeat(${data.length},1fr)`, gap:10 }}>
              {data.map((s, i) => (
                <div key={i} style={{ borderRadius:12, border:`0.5px solid ${BD_ALPHA[i]}`, background:BG_ALPHA[i], backdropFilter:"blur(10px)", padding:"16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:COLORS[i], flexShrink:0 }} />
                    <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:COLORS[i], letterSpacing:"-0.01em", lineHeight:1 }}>{s.ticker}</span>
                    <span style={{ marginLeft:"auto", fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, letterSpacing:"0.04em", ...signalStyle(s.signal) }}>
                      {s.signal}
                    </span>
                  </div>
                  <p style={{ fontSize:11, color:T3, marginBottom:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</p>
                  <p style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1, marginBottom:10 }}>
                    {fmt(s.current_price)}
                  </p>
                  <div style={{ display:"flex", gap:12, fontSize:11, fontWeight:500 }}>
                    <span style={{ color:pctColor(s.change_1w)  }}>{pctFmt(s.change_1w)}  <span style={{ color:T3, fontWeight:400 }}>1W</span></span>
                    <span style={{ color:pctColor(s.change_1mo) }}>{pctFmt(s.change_1mo)} <span style={{ color:T3, fontWeight:400 }}>1M</span></span>
                    <span style={{ color:pctColor(s.change_3mo) }}>{pctFmt(s.change_3mo)} <span style={{ color:T3, fontWeight:400 }}>3M</span></span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── NORMALISED CHART ── */}
            <Card className="fade-up" style={{ overflow:"hidden" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                <div>
                  <SectionLabel>Normalised Performance</SectionLabel>
                  <p style={{ fontSize:11, color:T3, marginTop:4 }}>% return from 3 months ago · base = 0%</p>
                </div>
                <div style={{ display:"flex", gap:16 }}>
                  {data.map((s, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:COLORS[i] }}>
                      <span style={{ width:20, height:2, background:COLORS[i], borderRadius:2, display:"inline-block" }} />
                      {s.ticker}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding:"16px" }}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill:T3, fontSize:10, fontFamily:"'DM Sans',sans-serif" }} interval={14} />
                    <YAxis tick={{ fill:T3, fontSize:10, fontFamily:"'DM Sans',sans-serif" }} tickFormatter={v => `${v}%`} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.10)" />
                    <Tooltip
                      contentStyle={{ background:"#1a1a1a", border:`0.5px solid ${BDR}`, borderRadius:8, fontSize:12, fontFamily:"'DM Sans',sans-serif", color:T1 }}
                      formatter={(v: any, name: any) => [`${v}%`, name]}
                    />
                    {data.map((s, i) => (
                      <Line key={s.ticker} type="monotone" dataKey={s.ticker} stroke={COLORS[i]} dot={false} strokeWidth={1.5} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* ── METRIC SECTIONS ── */}
            {SECTIONS.map(section => (
              <Card key={section.title} className="fade-up" style={{ overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                  <SectionLabel>{section.title}</SectionLabel>
                  <div style={{ display:"flex", gap:20 }}>
                    {data.map((s, i) => (
                      <span key={i} style={{ fontSize:11, fontWeight:700, color:COLORS[i], minWidth:70, textAlign:"right" }}>{s.ticker}</span>
                    ))}
                  </div>
                </div>
                <div>
                  {section.rows.map((row, ri) => {
                    const winnerIdx = best(row.key, row.higher);
                    return (
                      <div key={ri} className="metric-row">
                        <span style={{ fontSize:12, color:T2, flex:1 }}>{row.label}</span>
                        <div style={{ display:"flex", gap:20 }}>
                          {data.map((s, i) => {
                            const val       = s[row.key];
                            const formatted = row.fmt(val as any);
                            const isWinner  = i === winnerIdx && data.length > 1;
                            const valColor  = (row as any).color && typeof val === "number" ? pctColor(val) : T2;
                            return (
                              <div key={i} style={{ textAlign:"right", minWidth:70 }}>
                                <span style={{
                                  fontSize:12, fontWeight:600,
                                  color: isWinner ? COLORS[i] : valColor,
                                  textDecoration: isWinner ? "underline dotted" : "none",
                                }}>
                                  {formatted}
                                </span>
                                {isWinner && (
                                  <span style={{ fontSize:8, marginLeft:3, color:COLORS[i] }}>★</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}

            {/* ── VERDICT ── */}
            {data.length >= 2 && (
              <Card className="fade-up" style={{ overflow:"hidden" }}>
                <div style={{ padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                  <SectionLabel>Quick Verdict</SectionLabel>
                </div>
                <div style={{ padding:"16px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:`repeat(${data.length},1fr)`, gap:10, marginBottom:14 }}>
                    {data.map((s, i) => {
                      const stars = [
                        s.change_3mo > 0 ? 1 : 0,
                        s.sharpe_ratio > 1 ? 1 : 0,
                        s.rsi < 70 && s.rsi > 30 ? 1 : 0,
                        s.signal === "BUY" ? 1 : 0,
                        s.pe_ratio > 0 && s.pe_ratio < 30 ? 1 : 0,
                        s.roe > 15 ? 1 : 0,
                      ];
                      const score  = stars.reduce((a: number, b: number) => a + b, 0);
                      const label  = score >= 5 ? "Strong" : score >= 3 ? "Moderate" : "Weak";
                      const lcolor = score >= 5 ? UP : score >= 3 ? AMB : DN;
                      return (
                        <div key={i} className="verdict-card">
                          <p style={{ fontFamily:"'DM Serif Display',serif", fontSize:16, color:COLORS[i], marginBottom:6 }}>{s.ticker}</p>
                          <p style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:lcolor, letterSpacing:"-0.02em", marginBottom:4 }}>{label}</p>
                          <p style={{ fontSize:11, color:T3, marginBottom:10 }}>{score}/6 signals positive</p>
                          <div style={{ display:"flex", justifyContent:"center", gap:4 }}>
                            {stars.map((st: number, si: number) => (
                              <span key={si} style={{ fontSize:10, color: st ? AMB : T3 }}>★</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize:11, color:T3, textAlign:"center" }}>
                    ★ = signal positive · Based on 3M return, Sharpe, RSI, SMA signal, P/E &lt; 30, ROE &gt; 15%
                  </p>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && data.length === 0 && (
          <Card className="fade-up" style={{ padding:"60px 24px", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:14, opacity:0.3 }}>⚖</div>
            <div style={{ fontSize:14, color:T2, marginBottom:6 }}>Enter NSE symbols above to compare</div>
            <div style={{ fontSize:12, color:T3 }}>Try the presets for quick comparisons</div>
          </Card>
        )}

        {/* ── FOOTER ── */}
        {marketStatus && (
          <div style={{ textAlign:"center", fontSize:11, color:T3, paddingBottom:4 }}>
            {marketStatus.is_live
              ? "⚡ Live data via Angel One · Indices refresh on load"
              : `Market closed · Opens ${marketStatus.market_open} IST weekdays`}
          </div>
        )}

      </div>
    </>
  );
}