"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine,
} from "recharts";
import { FiRefreshCw, FiUpload, FiDownload } from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge } from "@/hooks/MarketUI";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import ParticleCanvas from "@/components/ParticleCanvas";

/* ─── Tokens ────────────────────────────────────────────────────── */
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
interface PnLSummary {
  total_invested:    number;
  current_value:     number;
  total_pnl:         number;
  total_pnl_pct:     number;
  realised_pnl:      number;
  unrealised_pnl:    number;
  stcg_tax:          number;
  ltcg_tax:          number;
  total_tax:         number;
  best_performer:    string;
  worst_performer:   string;
}
interface DailyPnL   { date: string; pnl: number; cumulative: number; }
interface MonthlyPnL { month: string; pnl: number; }
interface YearlyPnL  { year: string;  pnl: number; }
interface StockPnL   {
  ticker: string; name: string;
  invested: number; current_value: number;
  pnl: number; pnl_pct: number;
  holding_days: number; tax_category: "STCG" | "LTCG";
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

function Badge({ children, color = "neu" }: { children: React.ReactNode; color?: "up"|"dn"|"amb"|"neu" }) {
  const bg  = color==="up"?UP_BG  :color==="dn"?DN_BG  :color==="amb"?AMB_BG  :"rgba(255,255,255,0.05)";
  const bdr = color==="up"?UP_BDR :color==="dn"?DN_BDR :color==="amb"?AMB_BDR :BDR;
  const cl  = color==="up"?UP     :color==="dn"?DN     :color==="amb"?AMB     :T3;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, background:bg, border:`0.5px solid ${bdr}`, color:cl, letterSpacing:"0.04em" }}>
      {children}
    </span>
  );
}

function Skeleton({ w = "100%", h = 16 }: { w?: string|number; h?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: 6 }} />;
}

function StatCard({ label, value, sub, color = T1, loading }: {
  label: string; value: string; sub?: string; color?: string; loading?: boolean;
}) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 10, color: T3, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>{label}</div>
      {loading
        ? <><Skeleton h={24} w="70%" /><div style={{marginTop:6}}><Skeleton h={12} w="50%" /></div></>
        : <>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: "clamp(18px,2.5vw,24px)", color, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4 }}>
              {value}
            </div>
            {sub && <div style={{ fontSize: 11, color: T3 }}>{sub}</div>}
          </>
      }
    </Card>
  );
}

const fmt    = (n: number) => (n < 0 ? "-₹" : "₹") + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmtCr  = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs/1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs/1e5).toFixed(1)} L`;
  return fmt(n);
};

/* ════════════════════════════════════════════════════════════════ */
export default function PnLPage() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const [summary,   setSummary]   = useState<PnLSummary | null>(null);
  const [daily,     setDaily]     = useState<DailyPnL[]>([]);
  const [monthly,   setMonthly]   = useState<MonthlyPnL[]>([]);
  const [yearly,    setYearly]    = useState<YearlyPnL[]>([]);
  const [stocks,    setStocks]    = useState<StockPnL[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<"daily"|"monthly"|"yearly">("monthly");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s, d, m, y, st] = await Promise.all([
        apiFetch("/pnl/summary"),
        apiFetch("/pnl/daily"),
        apiFetch("/pnl/monthly"),
        apiFetch("/pnl/yearly"),
        apiFetch("/pnl/stocks"),
      ]);
      setSummary(s);
      setDaily(d);
      setMonthly(m);
      setYearly(y);
      setStocks(st);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load P&L data");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg("");
    const form = new FormData();
    form.append("file", file);
    try {
      const token = localStorage.getItem("token") || "";
      const res   = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pnl/import-csv`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const data = await res.json();
      setUploadMsg(res.ok ? `✓ Imported ${data.imported ?? ""} transactions` : data.detail || "Upload failed");
      if (res.ok) fetchAll();
    } catch { setUploadMsg("Upload failed — check file format"); }
    setUploading(false);
    e.target.value = "";
  };

  const chartData = tab === "daily" ? daily.map(d => ({ name: d.date.slice(5), value: d.pnl, cumulative: d.cumulative }))
    : tab === "monthly" ? monthly.map(m => ({ name: m.month, value: m.pnl }))
    : yearly.map(y => ({ name: y.year, value: y.pnl }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const v = payload[0].value as number;
    return (
      <div style={{ background: "#1a1a1a", border: `0.5px solid ${BDR}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ color: T3, marginBottom: 4 }}>{label}</div>
        <div style={{ color: v >= 0 ? UP : DN, fontWeight: 600 }}>{fmt(v)}</div>
        {payload[1] && <div style={{ color: T2, marginTop: 2 }}>Cumulative: {fmt(payload[1].value)}</div>}
      </div>
    );
  };

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

        .skel { background: linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%); background-size:400% 100%; animation:shimmer 1.5s infinite; }
        .fade-up { animation: fade-up .35s ease-out both; }

        .tab-btn {
          padding: 7px 16px; border-radius: 7px;
          font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all .15s;
          background: transparent; border: 0.5px solid transparent; color: ${T3};
        }
        .tab-btn.active { background: rgba(255,255,255,0.06); border-color: ${BDR}; color: ${T1}; }
        .tab-btn:hover:not(.active) { color: ${T2}; }

        .stock-row { display:flex; align-items:center; padding:12px 18px; border-bottom:0.5px solid ${BDR}; transition:background .15s; cursor:pointer; }
        .stock-row:last-child { border-bottom:none; }
        .stock-row:hover { background:rgba(255,255,255,0.025); }

        .upload-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 8px;
          font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          background: rgba(255,255,255,0.05); border: 0.5px solid ${BDR}; color: ${T2};
          transition: all .15s;
        }
        .upload-btn:hover { background: rgba(255,255,255,0.08); color: ${T1}; border-color: rgba(255,255,255,0.15); }

        .refresh-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 8px;
          background: transparent; border: 0.5px solid ${BDR};
          color: ${T3}; font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all .15s;
        }
        .refresh-btn:hover { border-color: ${T2}; color: ${T2}; }

        @media (max-width: 900px) { .pnl-grid-4 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .pnl-grid-4 { grid-template-columns: 1fr !important; } .pnl-header { flex-direction: column !important; } }
      `}</style>

      <div style={{
        position: "relative", zIndex: 4,
        minHeight: "100vh", padding: "20px 24px",
        fontFamily: "'DM Sans', sans-serif", color: T1,
        display: "flex", flexDirection: "column", gap: 12,
      }}>

        {/* ── HEADER ── */}
        <div className="pnl-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>
                P&amp;L Statement
              </h1>
              <MarketBadge status={marketStatus} />
            </div>
            <p style={{ fontSize:12, color:T3 }}>Realised · Unrealised · Tax estimate · Stock breakdown</p>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <label className="upload-btn">
              <FiUpload size={13} />
              {uploading ? "Uploading…" : "Import CSV"}
              <input type="file" accept=".csv" style={{ display:"none" }} onChange={handleCsvUpload} disabled={uploading} />
            </label>
            <button className="refresh-btn" onClick={fetchAll}>
              <FiRefreshCw size={12} style={{ animation: loading ? "spin .7s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>
        </div>

        {/* Upload feedback */}
        {uploadMsg && (
          <div style={{ fontSize:12, color: uploadMsg.startsWith("✓") ? UP : DN, background: uploadMsg.startsWith("✓") ? UP_BG : DN_BG, border:`0.5px solid ${uploadMsg.startsWith("✓") ? UP_BDR : DN_BDR}`, borderRadius:8, padding:"9px 14px" }}>
            {uploadMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontSize:12, color:DN, background:DN_BG, border:`0.5px solid ${DN_BDR}`, borderRadius:8, padding:"9px 14px" }}>
            {error}
          </div>
        )}

        {/* ── SUMMARY CARDS ── */}
        <div className="pnl-grid-4 fade-up" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          <StatCard label="Total Invested"   value={summary ? fmtCr(summary.total_invested)  : "—"} loading={loading} />
          <StatCard label="Current Value"    value={summary ? fmtCr(summary.current_value)   : "—"} loading={loading} color={T1} />
          <StatCard
            label="Total P&L"
            value={summary ? fmtCr(summary.total_pnl) : "—"}
            sub={summary ? fmtPct(summary.total_pnl_pct) : undefined}
            color={summary ? (summary.total_pnl >= 0 ? UP : DN) : T1}
            loading={loading}
          />
          <StatCard label="Est. Tax Liability" value={summary ? fmtCr(summary.total_tax) : "—"} sub={summary ? `STCG ₹${(summary.stcg_tax/1e3).toFixed(1)}K · LTCG ₹${(summary.ltcg_tax/1e3).toFixed(1)}K` : undefined} color={AMB} loading={loading} />
        </div>

        {/* ── REALISED / UNREALISED ── */}
        <div className="fade-up" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <StatCard label="Realised P&L"   value={summary ? fmtCr(summary.realised_pnl)   : "—"} color={summary?.realised_pnl   != null ? (summary.realised_pnl   >= 0 ? UP : DN) : T1} loading={loading} sub="Closed positions" />
          <StatCard label="Unrealised P&L" value={summary ? fmtCr(summary.unrealised_pnl) : "—"} color={summary?.unrealised_pnl != null ? (summary.unrealised_pnl >= 0 ? UP : DN) : T1} loading={loading} sub="Open positions" />
        </div>

        {/* ── TAX BREAKDOWN ── */}
        {!loading && summary && (
          <Card className="fade-up" style={{ overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 18px", borderBottom:`0.5px solid ${BDR}` }}>
              <SectionLabel>Tax Estimate (FY)</SectionLabel>
              <Badge color="amb">Indicative only</Badge>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", padding:"16px 18px", gap:16 }}>
              {[
                { label:"STCG (15%)",  value: fmt(summary.stcg_tax),  sub:"Holdings < 1 year", color: AMB },
                { label:"LTCG (10%)",  value: fmt(summary.ltcg_tax),  sub:"Holdings > 1 year, gains > ₹1L", color: AMB },
                { label:"Total Tax",   value: fmt(summary.total_tax), sub:"Approximate liability", color: DN  },
              ].map(t => (
                <div key={t.label}>
                  <div style={{ fontSize:10, color:T3, letterSpacing:"0.06em", marginBottom:6, textTransform:"uppercase" }}>{t.label}</div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:t.color, letterSpacing:"-0.02em", marginBottom:3 }}>{t.value}</div>
                  <div style={{ fontSize:11, color:T3 }}>{t.sub}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── CHART ── */}
        <Card className="fade-up" style={{ overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 18px", borderBottom:`0.5px solid ${BDR}`, flexWrap:"wrap", gap:10 }}>
            <SectionLabel>P&amp;L Over Time</SectionLabel>
            <div style={{ display:"flex", gap:4 }}>
              {(["daily","monthly","yearly"] as const).map(t => (
                <button key={t} className={`tab-btn${tab===t?" active":""}`} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding:"16px" }}>
            {loading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[80,60,90,70,85,65,75].map((w,i) => <Skeleton key={i} w={`${w}%`} h={12} />)}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                {tab === "daily" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill:T3, fontSize:10 }} interval={Math.floor(chartData.length/6)} />
                    <YAxis tick={{ fill:T3, fontSize:10 }} tickFormatter={v => fmtCr(v)} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.10)" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value"      stroke={UP}  dot={false} strokeWidth={1.5} name="Daily P&L" />
                    <Line type="monotone" dataKey="cumulative" stroke={AMB} dot={false} strokeWidth={1}   name="Cumulative" strokeDasharray="4 2" />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} barSize={tab==="yearly"?40:18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill:T3, fontSize:10 }} />
                    <YAxis tick={{ fill:T3, fontSize:10 }} tickFormatter={v => fmtCr(v)} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.10)" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[3,3,0,0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={(d as any).value >= 0 ? UP : DN} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* ── STOCK BREAKDOWN ── */}
        <Card className="fade-up" style={{ overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 18px", borderBottom:`0.5px solid ${BDR}` }}>
            <SectionLabel>Stock Breakdown</SectionLabel>
            <span style={{ fontSize:11, color:T3 }}>{stocks.length} positions</span>
          </div>

          {loading ? (
            <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:10 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    <Skeleton w={80} h={14} /><Skeleton w={120} h={10} />
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5, alignItems:"flex-end" }}>
                    <Skeleton w={70} h={14} /><Skeleton w={50} h={10} />
                  </div>
                </div>
              ))}
            </div>
          ) : stocks.length === 0 ? (
            <div style={{ padding:"48px 24px", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:0.3 }}>📊</div>
              <div style={{ fontSize:13, color:T2, marginBottom:4 }}>No stock data yet</div>
              <div style={{ fontSize:11, color:T3 }}>Import a CSV or add transactions to see your P&L breakdown</div>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 80px", gap:8, padding:"8px 18px", borderBottom:`0.5px solid ${BDR}`, background:"rgba(255,255,255,0.02)" }}>
                {["Stock","Invested","Value","P&L","Tax"].map(h => (
                  <div key={h} style={{ fontSize:10, fontWeight:500, letterSpacing:"0.07em", color:T3, textTransform:"uppercase", textAlign: h==="Stock"?"left":"right" }}>{h}</div>
                ))}
              </div>
              {stocks.map((s, i) => (
                <div key={i} className="stock-row" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 80px", gap:8 }}
                  onClick={() => router.push(`/charts?ticker=${s.ticker}`)}>
                  <div>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:14, color:T1, letterSpacing:"-0.01em" }}>{s.ticker}</div>
                    <div style={{ fontSize:11, color:T3, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name} · {s.holding_days}d held</div>
                  </div>
                  <div style={{ textAlign:"right", fontFamily:"'DM Serif Display',serif", fontSize:13, color:T2 }}>{fmtCr(s.invested)}</div>
                  <div style={{ textAlign:"right", fontFamily:"'DM Serif Display',serif", fontSize:13, color:T1 }}>{fmtCr(s.current_value)}</div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:13, color: s.pnl>=0?UP:DN }}>{fmtCr(s.pnl)}</div>
                    <div style={{ fontSize:11, color: s.pnl_pct>=0?UP:DN, marginTop:1 }}>{fmtPct(s.pnl_pct)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <Badge color={s.tax_category==="LTCG"?"up":"amb"}>{s.tax_category}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── PERFORMERS ── */}
        {!loading && summary && (
          <div className="fade-up" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Card style={{ padding:"16px 18px" }}>
              <div style={{ fontSize:10, color:T3, letterSpacing:"0.06em", marginBottom:8, textTransform:"uppercase" }}>Best Performer</div>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:UP, letterSpacing:"-0.02em" }}>{summary.best_performer || "—"}</div>
            </Card>
            <Card style={{ padding:"16px 18px" }}>
              <div style={{ fontSize:10, color:T3, letterSpacing:"0.06em", marginBottom:8, textTransform:"uppercase" }}>Worst Performer</div>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:DN, letterSpacing:"-0.02em" }}>{summary.worst_performer || "—"}</div>
            </Card>
          </div>
        )}

        <div style={{ textAlign:"center", fontSize:11, color:T3, paddingBottom:4 }}>
          Tax figures are indicative estimates only · Consult a CA for accurate tax computation
        </div>
      </div>
    </>
  );
}