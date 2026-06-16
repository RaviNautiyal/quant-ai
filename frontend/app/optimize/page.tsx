"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { FiRefreshCw, FiZap } from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge, MarketClosedBanner } from "@/hooks/MarketUI";
import { apiFetch, apiPost } from "@/lib/apiFetch";
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

const SLICE_COLORS = [UP, AMB, "#60a5fa", "#f472b6", "#a78bfa", "#22d3ee", "#86efac", "#fbbf24"];

const HORIZONS = [
  { label: "Short",  value: "short",  desc: "< 3 months"  },
  { label: "Medium", value: "medium", desc: "3–12 months" },
  { label: "Long",   value: "long",   desc: "> 1 year"    },
];

const RISKS = [
  { label: "Low",    value: "low",    bg: UP_BG,  bdr: UP_BDR,  cl: UP  },
  { label: "Medium", value: "medium", bg: AMB_BG, bdr: AMB_BDR, cl: AMB },
  { label: "High",   value: "high",   bg: DN_BG,  bdr: DN_BDR,  cl: DN  },
];

const HOW_IT_WORKS = [
  "Fetches your open positions from transaction history",
  "Fetches 3-month OHLCV data from Angel One",
  "Calculates expected return and annualised volatility",
  "Filters stocks by your selected risk tolerance",
  "Runs Greedy Knapsack to maximise risk-adjusted return",
  "AI quant advisor then reviews and improves the allocation",
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

function MarkdownText({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {text.split("\n").map((line, i) => {
        const fmt = line.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${T1}">$1</strong>`);
        if (/^[📊⚖️📈🧠🎯⚡⚠️🔥]/.test(line)) return (
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
export default function OptimizePage() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const [data,          setData]          = useState<any>(null);
  const [aiAnalysis,    setAiAnalysis]    = useState("");
  const [loading,       setLoading]       = useState(false);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [riskTolerance, setRiskTolerance] = useState("medium");
  const [horizon,       setHorizon]       = useState("medium");
  const [error,         setError]         = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const optimizePortfolio = async () => {
    setLoading(true); setData(null); setAiAnalysis(""); setError("");
    try {
      const result = await apiFetch(`/analysis/portfolio-optimize?risk_tolerance=${riskTolerance}`);
      if (result.message && !result.optimized_allocation?.length) {
        setError(result.message);
      } else {
        setData(result);
        runAiAnalysis(result, riskTolerance, horizon);
      }
    } catch { setError("Failed to connect to server"); }
    setLoading(false);
  };

  const runAiAnalysis = async (optimizationResult: any, risk: string, hor: string) => {
    if (!optimizationResult?.optimized_allocation?.length) return;
    setAiLoading(true);
    const holdings = optimizationResult.optimized_allocation
      .map((s: any) => `- ${s.ticker}: ₹${s.allocation?.toLocaleString("en-IN")} (Expected return: ${(s.expected_return * 100).toFixed(1)}%, Risk: ${(s.risk * 100).toFixed(1)}%)`)
      .join("\n");
    const prompt = `Capital: ₹${optimizationResult.total_budget?.toLocaleString("en-IN")}\nHoldings (Algorithm-suggested allocation):\n${holdings}\nRisk Appetite: ${risk.charAt(0).toUpperCase() + risk.slice(1)}\nInvestment Horizon: ${hor.charAt(0).toUpperCase() + hor.slice(1)}\n\nOptimize this portfolio.`;
    try {
      const d = await apiPost("/ai/chat", { message: prompt, history: [] });
      setAiAnalysis(d.response || "");
    } catch { setAiAnalysis("AI analysis unavailable."); }
    setAiLoading(false);
  };

  const pieData    = (data?.optimized_allocation || []).map((s: any) => ({ name: s.ticker, value: s.allocation }));
  const totalAlloc = pieData.reduce((sum: number, s: any) => sum + s.value, 0);
  const fmt        = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0 });

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

        .toggle-btn {
          padding: 8px 18px; border-radius: 8px;
          font-size: 12px; font-weight: 500; letter-spacing: 0.02em;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all .15s;
          background: rgba(255,255,255,0.04); border: 0.5px solid ${BDR}; color: ${T3};
        }
        .toggle-btn:hover:not(.active-up):not(.active-amb):not(.active-dn):not(.active-neu) {
          color: ${T2}; border-color: rgba(255,255,255,0.15);
        }
        .toggle-btn.active-up  { background: ${UP_BG};  border-color: ${UP_BDR};  color: ${UP};  }
        .toggle-btn.active-amb { background: ${AMB_BG}; border-color: ${AMB_BDR}; color: ${AMB}; }
        .toggle-btn.active-dn  { background: ${DN_BG};  border-color: ${DN_BDR};  color: ${DN};  }
        .toggle-btn.active-neu { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.20); color: ${T1}; }

        .run-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 22px; border-radius: 8px;
          font-size: 13px; font-weight: 500; letter-spacing: 0.02em;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all .15s;
          background: rgba(255,255,255,0.07);
          border: 0.5px solid rgba(255,255,255,0.12);
          color: ${T1};
        }
        .run-btn:hover:not(:disabled) { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.20); }
        .run-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .position-row { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:0.5px solid ${BDR}; transition:background .15s; }
        .position-row:last-child { border-bottom: none; }
        .position-row:hover { background: rgba(255,255,255,0.02); }

        @media (max-width: 768px) {
          .op-header   { flex-direction: column !important; align-items: flex-start !important; }
          .op-grid-2   { grid-template-columns: 1fr !important; }
          .op-grid-3   { grid-template-columns: 1fr 1fr !important; }
          .op-controls { grid-template-columns: 1fr !important; }
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
        <div className="op-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>
                Portfolio Optimizer
              </h1>
              <MarketBadge status={marketStatus} />
            </div>
            <p style={{ fontSize:12, color:T3 }}>Greedy Knapsack algorithm · Quant AI analysis · NSE/BSE</p>
          </div>
        </div>

        <MarketClosedBanner status={marketStatus} />

        {/* ── CONTROLS CARD ── */}
        <Card style={{ overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
            <SectionLabel>Configure Optimization</SectionLabel>
          </div>

          <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:16 }}>
            <div className="op-controls" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

              {/* Risk Appetite */}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase" }}>Risk Appetite</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {RISKS.map(r => (
                    <button key={r.value}
                      className={`toggle-btn${riskTolerance === r.value ? ` active-${r.value === "low" ? "up" : r.value === "medium" ? "amb" : "dn"}` : ""}`}
                      onClick={() => setRiskTolerance(r.value)}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Investment Horizon */}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase" }}>Investment Horizon</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {HORIZONS.map(h => (
                    <button key={h.value}
                      className={`toggle-btn${horizon === h.value ? " active-neu" : ""}`}
                      onClick={() => setHorizon(h.value)}
                      title={h.desc}>
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop:`0.5px solid ${BDR}` }} />

            {/* Run row */}
            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <button className="run-btn" onClick={optimizePortfolio} disabled={loading}>
                <FiRefreshCw size={13} style={{ animation: loading ? "spin .7s linear infinite" : "none" }} />
                {loading ? "Optimizing…" : "Optimize My Portfolio"}
              </button>
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
            <div style={{ fontSize:12, color:T3 }}>Running optimization…</div>
          </div>
        )}

        {data && (
          <>
            {/* ── SUMMARY CARDS ── */}
            <div className="op-grid-3 fade-up" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
              {[
                { label:"Total Capital", value: fmt(data.total_budget),                sub: null,                                                                              cl: T1 },
                { label:"Allocated",     value: fmt(totalAlloc),                       sub: `${data.total_budget ? ((totalAlloc/data.total_budget)*100).toFixed(0) : 0}% of capital`, cl: UP },
                { label:"Positions",     value: data.optimized_allocation?.length ?? 0, sub: data.algorithm,                                                                   cl: T1 },
              ].map(card => (
                <Card key={card.label} style={{ padding:"14px 16px" }}>
                  <div style={{ fontSize:10, color:T3, letterSpacing:"0.06em", marginBottom:6 }}>{card.label.toUpperCase()}</div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(18px,2.5vw,22px)", color:card.cl, letterSpacing:"-0.02em", lineHeight:1, marginBottom:4 }}>
                    {card.value}
                  </div>
                  {card.sub && <div style={{ fontSize:11, color:T3 }}>{card.sub}</div>}
                </Card>
              ))}
            </div>

            {/* ── PIE + POSITIONS ── */}
            <div className="op-grid-2 fade-up" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>

              {/* Pie chart */}
              {pieData.length > 0 && (
                <Card style={{ overflow:"hidden" }}>
                  <div style={{ padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                    <SectionLabel>Allocation Breakdown</SectionLabel>
                  </div>
                  <div style={{ padding:"16px" }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false}
                          style={{ fontSize:11, fontFamily:"'DM Sans',sans-serif", fill:T2 }}>
                          {pieData.map((_: any, i: number) => (
                            <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background:"#1a1a1a", border:`0.5px solid ${BDR}`, borderRadius:8, fontSize:11, fontFamily:"'DM Sans',sans-serif", color:T1 }}
                          formatter={(v: any) => [fmt(v), "Allocation"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Positions */}
              <Card style={{ overflow:"hidden" }}>
                <div style={{ padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                  <SectionLabel>Position Details</SectionLabel>
                </div>
                <div>
                  {data.optimized_allocation?.map((s: any, i: number) => {
                    const allocPct = totalAlloc > 0 ? (s.allocation / totalAlloc * 100).toFixed(1) : 0;
                    const ret      = (s.expected_return * 100).toFixed(2);
                    const risk     = (s.risk * 100).toFixed(2);
                    const color    = SLICE_COLORS[i % SLICE_COLORS.length];
                    return (
                      <div key={i} className="position-row">
                        <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                          <span style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />
                          <div style={{ minWidth:0 }}>
                            <p style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, color, letterSpacing:"-0.01em", lineHeight:1.1 }}>{s.ticker}</p>
                            <p style={{ fontSize:11, color:T3, marginTop:2 }}>Risk: {risk}%</p>
                          </div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <p style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, color:T1, letterSpacing:"-0.01em" }}>{fmt(s.allocation)}</p>
                          <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end", marginTop:2 }}>
                            <span style={{ fontSize:11, color:T3 }}>{allocPct}%</span>
                            <span style={{ fontSize:11, fontWeight:600, color: Number(ret) >= 0 ? UP : DN }}>
                              {Number(ret) >= 0 ? "+" : ""}{ret}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* ── AI ANALYSIS ── */}
            <Card className="fade-up" style={{ overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                <div style={{ width:26, height:26, borderRadius:8, background:UP_BG, border:`0.5px solid ${UP_BDR}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <FiZap size={12} style={{ color:UP }} />
                </div>
                <SectionLabel>Quant AI Analysis</SectionLabel>
                {aiLoading && (
                  <span className="ai-pulse" style={{ fontSize:11, color:T3, marginLeft:"auto" }}>Analysing…</span>
                )}
              </div>
              <div style={{ padding:"16px" }}>
                {aiLoading ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[100,85,92,78,88,70].map((w,i) => (
                      <div key={i} className="skel" style={{ height:12, width:`${w}%`, borderRadius:6 }} />
                    ))}
                  </div>
                ) : aiAnalysis ? (
                  <MarkdownText text={aiAnalysis} />
                ) : (
                  <p style={{ fontSize:13, color:T3 }}>AI analysis will appear here after optimization.</p>
                )}
              </div>
            </Card>

            {/* ── HOW IT WORKS ── */}
            <Card className="fade-up" style={{ overflow:"hidden" }}>
              <div style={{ padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                <SectionLabel>How It Works</SectionLabel>
              </div>
              <div style={{ padding:"16px", display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:10 }}>
                {HOW_IT_WORKS.map((t, i) => (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <span style={{ fontSize:10, fontWeight:700, color:UP, flexShrink:0, marginTop:2, width:16, textAlign:"right" }}>{i + 1}.</span>
                    <span style={{ fontSize:12, color:T2, lineHeight:1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ── EMPTY STATE ── */}
        {!data && !loading && (
          <Card className="fade-up" style={{ padding:"60px 24px", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:14, opacity:0.3 }}>⚙</div>
            <div style={{ fontSize:14, color:T2, marginBottom:6 }}>Select your risk appetite and horizon, then optimise</div>
            <div style={{ fontSize:12, color:T3 }}>Uses your existing portfolio holdings as input</div>
          </Card>
        )}

        {/* ── FOOTER ── */}
        {marketStatus && (
          <div style={{ textAlign:"center", fontSize:11, color:T3, paddingBottom:4 }}>
            {marketStatus.is_live
              ? "⚡ Live data via Angel One · Optimisation runs on current prices"
              : `Market closed · Opens ${marketStatus.market_open} IST weekdays`}
          </div>
        )}

      </div>
    </>
  );
}