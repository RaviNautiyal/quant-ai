"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiRefreshCw, FiExternalLink } from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge } from "@/hooks/MarketUI";
import { apiPost, ApiError } from "@/lib/apiFetch";
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

const QUICK = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "ADANIENT", "WIPRO", "ICICIBANK"];

interface Article {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
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
  const bg  = color==="up"?UP_BG  : color==="dn"?DN_BG  : color==="amb"?AMB_BG  : "rgba(255,255,255,0.05)";
  const bdr = color==="up"?UP_BDR : color==="dn"?DN_BDR : color==="amb"?AMB_BDR : BDR;
  const cl  = color==="up"?UP     : color==="dn"?DN     : color==="amb"?AMB     : T3;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, background:bg, border:`0.5px solid ${bdr}`, color:cl, letterSpacing:"0.04em" }}>
      {children}
    </span>
  );
}

function SentimentBadge({ analysis }: { analysis: string }) {
  const lower     = analysis.toLowerCase();
  const isBullish = lower.includes("bullish") && !lower.includes("bearish");
  const isBearish = lower.includes("bearish") && !lower.includes("bullish");
  const mixed     = lower.includes("bullish") && lower.includes("bearish");

  if (mixed)     return <Badge color="amb">Mixed</Badge>;
  if (isBullish) return <Badge color="up">Bullish</Badge>;
  if (isBearish) return <Badge color="dn">Bearish</Badge>;
  return <Badge color="neu">Neutral</Badge>;
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {lines.map((line, i) => {
        const formatted = line.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${T1}">$1</strong>`);
        if (/^[📰⚡🎯📊🧠⚠️🔥]/.test(line)) return (
          <p key={i} style={{ fontWeight:600, color:T2, marginTop:14, fontSize:12, letterSpacing:"0.02em" }}
            dangerouslySetInnerHTML={{ __html: formatted }} />
        );
        if (line.startsWith("- ")) return (
          <div key={i} style={{ display:"flex", gap:8, fontSize:13 }}>
            <span style={{ color:T3, flexShrink:0, marginTop:2 }}>·</span>
            <span style={{ color:T2, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: formatted.slice(2) }} />
          </div>
        );
        if (!line.trim()) return <div key={i} style={{ height:4 }} />;
        return (
          <p key={i} style={{ fontSize:13, color:T2, lineHeight:1.6 }}
            dangerouslySetInnerHTML={{ __html: formatted }} />
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function NewsPage() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const [ticker,       setTicker]       = useState("");
  const [companyName,  setCompanyName]  = useState("");
  const [articles,     setArticles]     = useState<Article[]>([]);
  const [analysis,     setAnalysis]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [resolvedName, setResolvedName] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const analyzeNews = async (sym?: string) => {
    const symbol = (sym || ticker).trim().toUpperCase();
    if (!symbol) return;
    setTicker(symbol);
    setLoading(true);
    setArticles([]);
    setAnalysis("");
    setError("");
    setResolvedName("");

    try {
      const data = await apiPost("/news/analyze", { ticker: symbol, company_name: companyName });
      setArticles(data.articles || []);
      setAnalysis(data.analysis || "");
      setResolvedName(data.company_name || symbol);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not connect to server");
    }
    setLoading(false);
  };

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1)  return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
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

        .fade-up { animation: fade-up .35s ease-out both; }

        .news-input {
          background: rgba(255,255,255,0.04);
          border: 0.5px solid ${BDR};
          color: ${T1};
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 8px;
          outline: none;
          transition: border-color .15s;
        }
        .news-input::placeholder { color: ${T3}; }
        .news-input:focus { border-color: rgba(255,255,255,0.18); }

        .analyse-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: 8px;
          background: rgba(255,255,255,0.07);
          border: 0.5px solid rgba(255,255,255,0.12);
          color: ${T1}; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all .15s; white-space: nowrap;
        }
        .analyse-btn:hover:not(:disabled) { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.20); }
        .analyse-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .quick-btn {
          padding: 5px 10px; border-radius: 6px;
          background: rgba(255,255,255,0.04);
          border: 0.5px solid ${BDR};
          color: ${T3}; font-size: 11px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all .15s;
          letter-spacing: 0.03em;
        }
        .quick-btn:hover   { border-color: rgba(255,255,255,0.15); color: ${T2}; }
        .quick-btn.active  { background: rgba(61,186,106,0.08); border-color: ${UP_BDR}; color: ${UP}; }

        .article-row {
          padding: 14px 18px;
          border-bottom: 0.5px solid ${BDR};
          transition: background .12s;
          cursor: pointer;
        }
        .article-row:last-child { border-bottom: none; }
        .article-row:hover { background: rgba(255,255,255,0.02); }
        .article-row:hover .ext-icon { opacity: 1; }

        .ext-icon { opacity: 0; transition: opacity .15s; }

        @media (max-width: 768px) {
          .nw-search-row { flex-direction: column !important; }
          .nw-search-row input { width: 100% !important; }
          .nw-header { flex-direction: column !important; align-items: flex-start !important; }
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
        <div className="nw-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>
                News Analyzer
              </h1>
              <MarketBadge status={marketStatus} />
            </div>
            <p style={{ fontSize:12, color:T3 }}>AI-powered trading intelligence from NSE/BSE news</p>
          </div>
        </div>

        {/* ── SEARCH CARD ── */}
        <Card className="fade-up" style={{ padding:"18px 20px" }}>
          {/* Input row */}
          <div className="nw-search-row" style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            <input
              className="news-input"
              placeholder="Symbol e.g. RELIANCE"
              value={ticker}
              style={{ width:180, textTransform:"uppercase", letterSpacing:"0.05em" }}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && analyzeNews()}
            />
            <input
              className="news-input"
              placeholder="Company name (optional)"
              value={companyName}
              style={{ flex:1, minWidth:160 }}
              onChange={e => setCompanyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && analyzeNews()}
            />
            <button
              className="analyse-btn"
              onClick={() => analyzeNews()}
              disabled={loading || !ticker}
            >
              <FiRefreshCw size={13} style={{ animation: loading ? "spin .7s linear infinite" : "none" }} />
              {loading ? "Analysing…" : "Analyse"}
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop:`0.5px solid ${BDR}`, marginBottom:14 }} />

          {/* Quick picks */}
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <SectionLabel>Quick</SectionLabel>
            {QUICK.map(t => (
              <button
                key={t}
                className={`quick-btn${ticker === t ? " active" : ""}`}
                onClick={() => analyzeNews(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop:12, fontSize:12, color:DN, background:DN_BG, border:`0.5px solid ${DN_BDR}`, borderRadius:8, padding:"9px 14px" }}>
              {error}
            </div>
          )}
        </Card>

        {/* ── SPINNER ── */}
        {loading && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 0", gap:12 }}>
            <div style={{ width:28, height:28, border:`2px solid rgba(61,186,106,0.2)`, borderTopColor:UP, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
            <div style={{ fontSize:12, color:T3 }}>Fetching news & running analysis…</div>
          </div>
        )}

        {!loading && (
          <>
            {/* ── AI ANALYSIS ── */}
            {analysis && (
              <Card className="fade-up" style={{ overflow:"hidden" }}>
                {/* Card header */}
                <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:10, padding:"13px 18px", borderBottom:`0.5px solid ${BDR}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <SectionLabel>Trading Intelligence</SectionLabel>
                    <span style={{ fontSize:12, color:T2, fontWeight:500 }}>
                      {resolvedName && resolvedName !== ticker ? `${resolvedName} · ` : ""}{ticker}
                    </span>
                    <SentimentBadge analysis={analysis} />
                  </div>
                  <span style={{ fontSize:11, color:T3 }}>Powered by Gemini</span>
                </div>

                {/* Body */}
                <div style={{ padding:"16px 18px" }}>
                  <MarkdownText text={analysis} />
                </div>
              </Card>
            )}

            {/* ── ARTICLES ── */}
            {articles.length > 0 && (
              <Card className="fade-up" style={{ overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 18px", borderBottom:`0.5px solid ${BDR}` }}>
                  <SectionLabel>{articles.length} Recent Articles</SectionLabel>
                  <span style={{ fontSize:11, color:T3 }}>Google News · Financial press</span>
                </div>
                <div>
                  {articles.map((a, i) => (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="article-row"
                      style={{ display:"block", textDecoration:"none" }}
                    >
                      {/* Title row */}
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:5 }}>
                        <span style={{ fontSize:13, color:T1, fontWeight:500, lineHeight:1.45, flex:1 }}>{a.title}</span>
                        <FiExternalLink className="ext-icon" size={12} style={{ color:T3, flexShrink:0, marginTop:2 }} />
                      </div>

                      {/* Description */}
                      {a.description && (
                        <p style={{ fontSize:12, color:T3, lineHeight:1.55, marginBottom:8,
                          display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                          {a.description}
                        </p>
                      )}

                      {/* Meta */}
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:11, color:T3, background:"rgba(255,255,255,0.04)", border:`0.5px solid ${BDR}`, borderRadius:5, padding:"2px 8px" }}>
                          {a.source}
                        </span>
                        <span style={{ fontSize:11, color:T3 }}>{timeAgo(a.publishedAt)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* ── EMPTY STATE ── */}
            {!analysis && !articles.length && (
              <Card className="fade-up" style={{ padding:"64px 24px", textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:14, opacity:0.35 }}>📰</div>
                <div style={{ fontSize:14, color:T2, marginBottom:6 }}>Enter an NSE/BSE symbol to analyse news</div>
                <div style={{ fontSize:12, color:T3 }}>Get structured trading intelligence — not just headlines</div>
              </Card>
            )}
          </>
        )}

      </div>
    </>
  );
}