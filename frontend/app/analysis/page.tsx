"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge }     from "@/hooks/MarketUI";
import { FiRefreshCw, FiAlertTriangle } from "react-icons/fi";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import ParticleCanvas from "@/components/ParticleCanvas";

/* ─── Design tokens ─────────────────────────────────────────────── */
const BG     = "#111111";
const CARD   = "rgba(26,26,26,0.85)";
const SURF   = "#222222";
const BDR    = "#2c2c2c";
const T1     = "#f0f0ee";
const T2     = "#888884";
const T3     = "#555552";
const UP     = "#3dba6a";
const DN     = "#e05555";
const AMB    = "#c4943a";
const UP_BG  = "rgba(61,186,106,0.08)";
const DN_BG  = "rgba(224,85,85,0.08)";
const AMB_BG = "rgba(196,148,58,0.08)";
const UP_BDR = "rgba(61,186,106,0.20)";
const DN_BDR = "rgba(224,85,85,0.20)";
const AMB_BDR= "rgba(196,148,58,0.20)";

const TIMEFRAMES = [
  { label: "Swing",     value: "swing",     desc: "3M daily data" },
  { label: "Long Term", value: "long_term", desc: "1Y daily data" },
  { label: "Intraday",  value: "intraday",  desc: "Today 1-min"   },
];

const QUICK = ["RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","SBIN","ADANIENT","NIFTY"];

/* ─── Small components ──────────────────────────────────────────── */
function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: CARD,
      border: `0.5px solid ${BDR}`,
      borderRadius: 12,
      padding: "16px 18px",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", color: T3, textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </div>
  );
}

function Badge({ children, color = "neu" }: { children: React.ReactNode; color?: "up"|"dn"|"amb"|"neu" }) {
  const bg  = color === "up" ? UP_BG  : color === "dn" ? DN_BG  : color === "amb" ? AMB_BG  : "rgba(255,255,255,0.05)";
  const bdr = color === "up" ? UP_BDR : color === "dn" ? DN_BDR : color === "amb" ? AMB_BDR : BDR;
  const cl  = color === "up" ? UP     : color === "dn" ? DN     : color === "amb" ? AMB     : T3;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: bg, border: `0.5px solid ${bdr}`, color: cl, letterSpacing: "0.04em" }}>
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `0.5px solid ${BDR}` }}>
      <span style={{ fontSize: 12, color: T3, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: T1, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{value}</span>
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────── */
const fmt    = (n: number | null | undefined) =>
  n != null ? "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—";
const fmtCap = (n: number) => {
  if (!n) return "—";
  if (n >= 1e12) return `₹${(n / 1e12).toFixed(1)}L Cr`;
  if (n >= 1e7)  return `₹${(n / 1e7).toFixed(0)} Cr`;
  return "—";
};
const pct = (v: number | null) => v != null ? `${v >= 0 ? "+" : ""}${v}%` : "—";

const verdictStyle = (v: string) => {
  if (v?.includes("Strongly Bullish")) return { bg: UP_BG,  bdr: UP_BDR,  cl: UP  };
  if (v?.includes("Bullish"))          return { bg: UP_BG,  bdr: UP_BDR,  cl: UP  };
  if (v?.includes("Strongly Bearish")) return { bg: DN_BG,  bdr: DN_BDR,  cl: DN  };
  if (v?.includes("Bearish"))          return { bg: DN_BG,  bdr: DN_BDR,  cl: DN  };
  if (v?.includes("Neutral"))          return { bg: AMB_BG, bdr: AMB_BDR, cl: AMB };
  return { bg: "rgba(255,255,255,0.03)", bdr: BDR, cl: T2 };
};

const scoreColor = (s: number) =>
  s >= 70 ? UP : s >= 55 ? UP : s >= 45 ? AMB : DN;

/* ════════════════════════════════════════════════════════════════ */
export default function AnalysisPage() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const [ticker,    setTicker]    = useState("");
  const [timeframe, setTimeframe] = useState("swing");
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const analyze = async (sym?: string, tf?: string) => {
    const symbol = (sym || ticker).trim().toUpperCase();
    const frame  = tf || timeframe;
    if (!symbol) return;
    setLoading(true); setError(""); setData(null);
    try {
      const result = await apiFetch(`/analysis/analyze?stock=${symbol}&timeframe=${frame}`);
      setData(result);
      setTicker(symbol);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not connect to server");
    }
    setLoading(false);
  };

  const chartData = data
    ? data.technicals.price_history.dates.map((d: string, i: number) => ({
        date:   d.slice(5),
        close:  data.technicals.price_history.closes[i],
        sma50:  data.technicals.price_history.sma_50[i]  ?? null,
        sma200: data.technicals.price_history.sma_200[i] ?? null,
        ema20:  data.technicals.price_history.ema_20[i]  ?? null,
      }))
    : [];

  const targets: number[] = data?.trade_setup?.targets || [];
  const vs = data ? verdictStyle(data.verdict) : null;

  return (
    <>
      <ParticleCanvas />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111111; overflow-x: clip; }

        @keyframes fade-up  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes shimmer   { from { background-position:200% 0; } to { background-position:-200% 0; } }

        .fade-up { animation: fade-up .35s ease-out both; }
        .skel { background: linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%); background-size:400% 100%; animation:shimmer 1.5s infinite; border-radius:6px; }

        .an-input {
          background: ${SURF};
          border: 0.5px solid ${BDR};
          color: ${T1};
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color .2s;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .an-input::placeholder { color: ${T3}; text-transform: none; letter-spacing: 0; }
        .an-input:focus { border-color: ${T2}; }

        .tf-btn {
          padding: 8px 14px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all .15s;
          border: 0.5px solid ${BDR};
          background: transparent;
          color: ${T3};
        }
        .tf-btn:hover  { border-color: ${T2}; color: ${T2}; }
        .tf-btn.active { background: ${UP_BG}; border-color: ${UP_BDR}; color: ${UP}; }

        .quick-btn {
          padding: 4px 11px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all .15s;
          border: 0.5px solid ${BDR};
          background: transparent;
          color: ${T3};
          letter-spacing: 0.03em;
        }
        .quick-btn:hover  { border-color: ${T2}; color: ${T2}; }
        .quick-btn.active { background: ${UP_BG}; border-color: ${UP_BDR}; color: ${UP}; }

        .an-row:last-child { border-bottom: none !important; }

        .inst-row:hover { background: rgba(255,255,255,0.02); }

        @media (max-width: 768px) {
          .an-grid-2 { grid-template-columns: 1fr !important; }
          .an-grid-3 { grid-template-columns: 1fr 1fr !important; }
          .an-search-row { flex-direction: column; }
          .an-tf-row { flex-wrap: wrap; }
        }
      `}</style>

      <div style={{
        position:      "relative",
        zIndex:        4,
        minHeight:     "100vh",
        padding:       "20px 24px",
        fontFamily:    "'DM Sans', sans-serif",
        color:         T1,
        display:       "flex",
        flexDirection: "column",
        gap:           12,
      }}>

        {/* ── HEADER ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(20px,3vw,28px)", color: T1, letterSpacing: "-0.02em", lineHeight: 1 }}>
              Stock Analysis
            </h1>
            <MarketBadge status={marketStatus} />
          </div>
          <p style={{ fontSize: 12, color: T3 }}>Fundamentals · Technicals · Smart Money · Trade Setup</p>
        </div>

        {/* ── SEARCH ── */}
        <Card>
          <div className="an-search-row" style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              className="an-input"
              style={{ flex: 1, minWidth: 120 }}
              placeholder="e.g. RELIANCE"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && analyze()}
            />
            <div className="an-tf-row" style={{ display: "flex", gap: 6 }}>
              {TIMEFRAMES.map(t => (
                <button
                  key={t.value}
                  className={`tf-btn${timeframe === t.value ? " active" : ""}`}
                  title={t.desc}
                  onClick={() => { setTimeframe(t.value); if (ticker) analyze(ticker, t.value); }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => analyze()}
              disabled={loading || !ticker}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                cursor: ticker && !loading ? "pointer" : "not-allowed",
                border: `0.5px solid ${ticker && !loading ? UP_BDR : BDR}`,
                background: ticker && !loading ? UP_BG : "transparent",
                color: ticker && !loading ? UP : T3,
                transition: "all .15s",
                whiteSpace: "nowrap",
              }}
            >
              <FiRefreshCw size={13} style={{ animation: loading ? "spin .7s linear infinite" : "none" }} />
              {loading ? "Analysing…" : "Analyse"}
            </button>
          </div>

          {/* Quick picks */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T3, letterSpacing: "0.05em" }}>QUICK</span>
            {QUICK.map(t => (
              <button
                key={t}
                className={`quick-btn${ticker === t ? " active" : ""}`}
                onClick={() => { setTicker(t); analyze(t); }}
              >
                {t}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: DN, background: DN_BG, border: `0.5px solid ${DN_BDR}`, borderRadius: 7, padding: "8px 12px" }}>
              <FiAlertTriangle size={13} />
              {error}
            </div>
          )}
        </Card>

        {/* ── RESULTS ── */}
        {data && (
          <>
            {/* Verdict + Score */}
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }} >
              {/* Verdict */}
              <div style={{ background: vs!.bg, border: `0.5px solid ${vs!.bdr}`, borderRadius: 12, padding: "16px 18px", backdropFilter: "blur(10px)" }}>
                <SectionLabel>Overall Verdict</SectionLabel>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(18px,2.5vw,24px)", color: vs!.cl, letterSpacing: "-0.02em", marginBottom: 14, lineHeight: 1.1 }}>
                  {data.verdict}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="an-grid-2">
                  <div>
                    <div style={{ fontSize: 10, color: T3, letterSpacing: "0.06em", marginBottom: 4 }}>INVESTOR VIEW</div>
                    <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{data.investor_view}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T3, letterSpacing: "0.06em", marginBottom: 4 }}>TRADER VIEW</div>
                    <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{data.trader_view}</div>
                  </div>
                </div>
              </div>

              {/* Score */}
              <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <SectionLabel>Confidence Score</SectionLabel>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(48px,6vw,60px)", color: scoreColor(data.confidence), letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {data.confidence}
                </div>
                <div style={{ fontSize: 11, color: T3 }}>/ 100</div>
                {/* Bar */}
                <div style={{ width: "100%", height: 3, background: SURF, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${data.confidence}%`, background: scoreColor(data.confidence), borderRadius: 2, transition: "width .8s ease" }} />
                </div>
                {/* Sub scores */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, width: "100%", marginTop: 4 }}>
                  {[["Tech", data.scoring?.technical_total, 50], ["Fund", data.scoring?.fundamental_total, 30], ["Smart$", data.scoring?.smart_money_total, 20]].map(([label, val, max]) => (
                    <div key={label as string} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: T3, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: T2 }}>{val}/{max}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Trade Setup */}
            <Card className="fade-up">
              <SectionLabel>Trade Setup</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
                {/* Entry */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: `0.5px solid ${BDR}`, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: T3, letterSpacing: "0.06em", marginBottom: 6 }}>ENTRY</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T1, fontVariantNumeric: "tabular-nums" }}>{fmt(data.trade_setup?.entry)}</div>
                </div>
                {/* Stop loss */}
                <div style={{ background: DN_BG, border: `0.5px solid ${DN_BDR}`, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: DN, letterSpacing: "0.06em", marginBottom: 6 }}>STOP LOSS</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: DN, fontVariantNumeric: "tabular-nums" }}>{fmt(data.trade_setup?.stop_loss)}</div>
                  <div style={{ fontSize: 10, color: DN, opacity: 0.6, marginTop: 2 }}>-{data.trade_setup?.risk_pct}%</div>
                </div>
                {/* Targets */}
                {targets.map((t: number, i: number) => (
                  <div key={i} style={{ background: UP_BG, border: `0.5px solid ${UP_BDR}`, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: UP, letterSpacing: "0.06em", marginBottom: 6 }}>TARGET {i + 1}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: UP, fontVariantNumeric: "tabular-nums" }}>{fmt(t)}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: T3, lineHeight: 1.6 }}>
                Risk/Reward: <span style={{ color: T2 }}>{data.trade_setup?.risk_reward}</span>
                {" · "}Support: <span style={{ color: T2 }}>{fmt(data.technicals?.support_resistance?.nearest_support)}</span>
                {" · "}Resistance: <span style={{ color: T2 }}>{fmt(data.technicals?.support_resistance?.nearest_resistance)}</span>
              </div>
            </Card>

            {/* Price Chart */}
            <Card className="fade-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                <SectionLabel>Price · SMA 50/200 · EMA 20</SectionLabel>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {[["Price", T1], ["SMA 50", UP], ["SMA 200", AMB], ["EMA 20", DN]].map(([l, c]) => (
                    <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T3 }}>
                      <span style={{ width: 14, height: 1.5, background: c, display: "inline-block", borderRadius: 1 }} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 280 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: T3, fontSize: 10 }} interval={Math.floor(chartData.length / 8)} />
                      <YAxis tick={{ fill: T3, fontSize: 10 }} domain={["auto","auto"]}
                        tickFormatter={v => `₹${v.toLocaleString("en-IN")}`} width={68} />
                      <Tooltip
                        contentStyle={{ background: CARD, border: `0.5px solid ${BDR}`, borderRadius: 8, fontSize: 11, backdropFilter: "blur(10px)", fontFamily: "'DM Sans', sans-serif", color: T1 }}
                        formatter={(v: any, n: any) => [v ? `₹${v.toLocaleString("en-IN")}` : "—", n]}
                      />
                      <Line type="monotone" dataKey="close"  stroke={T1}  dot={false} strokeWidth={1.8} name="Price"   connectNulls />
                      <Line type="monotone" dataKey="sma50"  stroke={UP}  dot={false} strokeWidth={1.4} name="SMA 50"  strokeDasharray="5 5" connectNulls />
                      <Line type="monotone" dataKey="sma200" stroke={AMB} dot={false} strokeWidth={1.4} name="SMA 200" strokeDasharray="8 4" connectNulls />
                      <Line type="monotone" dataKey="ema20"  stroke={DN}  dot={false} strokeWidth={1}   name="EMA 20"  strokeDasharray="3 3" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Technicals + Fundamentals */}
            <div className="an-grid-2 fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

              <Card>
                <SectionLabel>Technicals</SectionLabel>
                <div>
                  {[
                    ["Trend",        data.technicals?.ma_signal?.replace(/_/g," ").toUpperCase()],
                    ["RSI (14)",     `${data.technicals?.rsi_current ?? "—"} — ${data.technicals?.rsi_signal ?? ""}`],
                    ["MACD",         data.technicals?.macd?.current?.crossover?.replace(/_/g," ") ?? "—"],
                    ["Bollinger",    data.technicals?.bollinger?.signal?.replace(/_/g," ") ?? "—"],
                    ["Volume",       data.technicals?.volume?.signal?.replace(/_/g," ") ?? "—"],
                    ["Volatility",   `${data.technicals?.volatility ?? "—"}% ann.`],
                    ["Sharpe",       data.technicals?.sharpe_ratio ?? "—"],
                    ["Max Drawdown", `${data.technicals?.max_drawdown ?? "—"}%`],
                    ["SMA 50",       fmt(data.technicals?.sma_50)],
                    ["SMA 200",      fmt(data.technicals?.sma_200)],
                    ["EMA 20",       fmt(data.technicals?.ema_20)],
                    ["BB Upper",     fmt(data.technicals?.bollinger?.upper)],
                    ["BB Lower",     fmt(data.technicals?.bollinger?.lower)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="an-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `0.5px solid ${BDR}` }}>
                      <span style={{ fontSize: 12, color: T3, flexShrink: 0 }}>{k}</span>
                      <span style={{ fontSize: 12, color: T2, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%", fontVariantNumeric: "tabular-nums" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionLabel>Fundamentals</SectionLabel>
                <div style={{ fontSize: 11, color: T3, marginBottom: 10 }}>
                  {data.fundamentals?.sector} · {data.fundamentals?.industry}
                </div>
                <div>
                  {[
                    ["Market Cap",     fmtCap(data.fundamentals?.market_cap)],
                    ["P/E Ratio",      data.fundamentals?.pe_ratio ?? "—"],
                    ["Forward P/E",    data.fundamentals?.forward_pe ?? "—"],
                    ["P/B Ratio",      data.fundamentals?.pb_ratio ?? "—"],
                    ["EPS",            data.fundamentals?.eps ? `₹${data.fundamentals.eps}` : "—"],
                    ["ROE",            pct(data.fundamentals?.roe)],
                    ["ROCE",           pct(data.fundamentals?.roce)],
                    ["Debt/Equity",    data.fundamentals?.debt_equity ?? "—"],
                    ["Revenue Growth", pct(data.fundamentals?.revenue_growth)],
                    ["Profit Margin",  pct(data.fundamentals?.profit_margin)],
                    ["Op. Margin",     pct(data.fundamentals?.operating_margin)],
                    ["Div. Yield",     pct(data.fundamentals?.dividend_yield)],
                    ["Beta",           data.fundamentals?.beta ?? "—"],
                    ["52W High",       fmt(data.fundamentals?.["52w_high"])],
                    ["52W Low",        fmt(data.fundamentals?.["52w_low"])],
                  ].map(([k, v]) => (
                    <div key={k as string} className="an-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `0.5px solid ${BDR}` }}>
                      <span style={{ fontSize: 12, color: T3, flexShrink: 0 }}>{k}</span>
                      <span style={{ fontSize: 12, color: T2, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Institutional Holders */}
            {data.smart_money?.institutional_holders?.length > 0 && (
              <Card className="fade-up">
                <SectionLabel>Institutional Holders</SectionLabel>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 280 }}>
                    <thead>
                      <tr style={{ borderBottom: `0.5px solid ${BDR}` }}>
                        {["Institution", "% Held", "Shares"].map(h => (
                          <th key={h} style={{ padding: "0 0 10px", textAlign: "left", fontSize: 10, fontWeight: 500, color: T3, letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.smart_money.institutional_holders.map((h: any, i: number) => (
                        <tr key={i} className="inst-row" style={{ borderBottom: `0.5px solid ${BDR}` }}>
                          <td style={{ padding: "9px 12px 9px 0", fontSize: 12, color: T2 }}>{h.name}</td>
                          <td style={{ padding: "9px 12px 9px 0", fontSize: 12, color: T1, fontVariantNumeric: "tabular-nums" }}>{h.pct_held}%</td>
                          <td style={{ padding: "9px 0",           fontSize: 12, color: T3, fontVariantNumeric: "tabular-nums" }}>{h.shares?.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Risks */}
            <Card className="fade-up" style={{ background: DN_BG, border: `0.5px solid ${DN_BDR}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <FiAlertTriangle size={13} style={{ color: DN, flexShrink: 0 }} />
                <SectionLabel>Risk Factors</SectionLabel>
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none" }}>
                {data.risks?.map((r: string, i: number) => (
                  <li key={i} style={{ display: "flex", gap: 10, fontSize: 12, color: T2, lineHeight: 1.6 }}>
                    <span style={{ color: DN, flexShrink: 0 }}>·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {/* ── EMPTY STATE ── */}
        {!data && !loading && (
          <Card style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, color: SURF, marginBottom: 12 }}>₹</div>
            <div style={{ fontSize: 14, color: T2, marginBottom: 6 }}>Enter an NSE symbol to run full analysis</div>
            <div style={{ fontSize: 12, color: T3 }}>Fundamentals · Technicals · Trade Setup · Verdict</div>
          </Card>
        )}

      </div>
    </>
  );
}