  "use client";

  import { useState, useEffect, useCallback } from "react";
  import { useRouter }       from "next/navigation";
  import { FiRefreshCw }     from "react-icons/fi";
  import { useMarketStatus } from "@/hooks/useMarketStatus";
  import { MarketBadge, MarketClosedBanner, PriceCell } from "@/hooks/MarketUI";
  import { useLivePrices }   from "@/hooks/useLivePrices";
  import { apiFetch }        from "@/lib/apiFetch";
import ParticleCanvas from "@/components/ParticleCanvas";
  import  {
    Skel, SkeletonStatCard, SkeletonCard,
      SkeletonTableRow, SkeletonChartCard,
      SkeletonMoverRow, PageLoader,
    } from "@/components/Skeletons";
 
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
  const AMB    = "#c4943a";
  const UP_BG  = "rgba(61,186,106,0.08)";
  const DN_BG  = "rgba(224,85,85,0.08)";
  const AMB_BG = "rgba(196,148,58,0.08)";
  const UP_BDR = "rgba(61,186,106,0.20)";
  const DN_BDR = "rgba(224,85,85,0.20)";
  const AMB_BDR= "rgba(196,148,58,0.20)";

  const MOVER_SYMBOLS = ["RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","SBIN","BAJFINANCE","WIPRO","AXISBANK","KOTAKBANK"];

  interface IndexData     { ticker: string; name: string; price: number; change: number; }
  interface MoverStock    { ticker: string; name: string; price: number; change: number; }
  interface MarketSummary { vix: number; sentiment: string; sentiment_color: string; gold: number; oil: number; usdinr: number; }

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
    const bg  = color==="up"?UP_BG  : color==="dn"?DN_BG  : color==="amb"?AMB_BG  : "rgba(255,255,255,0.05)";
    const bdr = color==="up"?UP_BDR : color==="dn"?DN_BDR : color==="amb"?AMB_BDR : BDR;
    const cl  = color==="up"?UP     : color==="dn"?DN     : color==="amb"?AMB     : T3;
    return (
      <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, background:bg, border:`0.5px solid ${bdr}`, color:cl, letterSpacing:"0.04em" }}>
        {children}
      </span>
    );
  }

  function Skeleton({ style }: { style?: React.CSSProperties }) {
    return  <Skel w="80%" h={12} />
  }

  /* ════════════════════════════════════════════════════════════════ */
  export default function MarketPage() {
    const router = useRouter();
    const [indices,     setIndices]     = useState<IndexData[]>([]);
    const [movers,      setMovers]      = useState<{ gainers: MoverStock[]; losers: MoverStock[] }>({ gainers: [], losers: [] });
    const [summary,     setSummary]     = useState<MarketSummary | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [fetching,    setFetching]    = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const marketStatus = useMarketStatus();

    const fetchAll = useCallback(async (silent = false) => {
      if (!silent) setLoading(true);
      setFetching(true);
      try {
        const [iData, mData, sData] = await Promise.all([
          apiFetch("/market/indices"),
          apiFetch("/market/movers"),
          apiFetch("/market/summary"),
        ]);
        setIndices(iData);
        setMovers({ gainers: mData?.gainers ?? [], losers: mData?.losers ?? [] });
        setSummary(sData);
        setLastUpdated(new Date());
      } catch (err) { console.error(err); }
      setLoading(false); setFetching(false);
    }, []);

    useEffect(() => {
      if (!localStorage.getItem("token")) { router.push("/login"); return; }
      fetchAll();
    }, []);

    const { prices, prevPrices, connected } = useLivePrices(MOVER_SYMBOLS, !!marketStatus?.is_live);
    const mergePrice = (s: MoverStock): MoverStock => ({ ...s, price: prices[s.ticker] ?? s.price });
    const liveGainers = (movers.gainers ?? []).map(mergePrice);
    const liveLosers  = (movers.losers  ?? []).map(mergePrice);

    const sentimentColor = (c: string) =>
      c === "green" ? UP : c === "yellow" ? AMB : c === "red" ? DN : T2;

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
          .live-dot { width:6px; height:6px; border-radius:50%; background:${UP}; display:inline-block; animation:pulse-d 1.8s ease-in-out infinite; }

          .idx-cell { padding: 14px 16px; border-right: 0.5px solid ${BDR}; border-bottom: 0.5px solid ${BDR}; transition: background .15s; }
          .idx-cell:hover { background: rgba(255,255,255,0.025); }

          .mover-row { display:flex; justify-content:space-between; align-items:center; padding: 11px 16px; border-bottom: 0.5px solid ${BDR}; cursor:pointer; transition: background .15s; }
          .mover-row:last-child { border-bottom: none; }
          .mover-row:hover { background: rgba(255,255,255,0.02); }

          .refresh-btn {
            display: flex; align-items: center; gap: 7px;
            padding: 8px 16px; border-radius: 8px;
            background: transparent; border: 0.5px solid ${BDR};
            color: ${T3}; font-size: 12px; font-weight: 500;
            font-family: 'DM Sans', sans-serif;
            cursor: pointer; transition: all .15s; white-space: nowrap;
          }
          .refresh-btn:hover { border-color: ${T2}; color: ${T2}; }

          @media (max-width: 768px) {
            .mk-grid-4 { grid-template-columns: 1fr 1fr !important; }
            .mk-grid-2 { grid-template-columns: 1fr !important; }
            .mk-header { flex-direction: column !important; align-items: flex-start !important; }
            .mk-refresh { width: 100% !important; justify-content: center !important; }
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
          <div className="mk-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
                <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>
                  Market Overview
                </h1>
                <MarketBadge status={marketStatus} />
                {marketStatus?.is_live && (
                  <Badge color={connected ? "up" : "amb"}>
                    {connected ? "⚡ Live" : "⟳ Connecting…"}
                  </Badge>
                )}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <p style={{ fontSize:12, color:T3 }}>Indices, movers and market sentiment</p>
                {lastUpdated && (
                  <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T3 }}>
                    <FiRefreshCw size={11} style={{ animation: fetching?"spin .7s linear infinite":"none", color: fetching?UP:T3 }} />
                    {lastUpdated.toLocaleTimeString("en-IN")}
                  </div>
                )}
              </div>
            </div>
            <button className="refresh-btn mk-refresh" onClick={() => fetchAll()}>
              <FiRefreshCw size={12} style={{ animation: fetching?"spin .7s linear infinite":"none" }} />
              Refresh
            </button>
          </div>

          <MarketClosedBanner status={marketStatus} />

          {/* ── LOADING ── */}
       

   {loading && <PageLoader message="Fetching market data…" />}

   {loading && [1,2,3,4,5].map(i => <SkeletonMoverRow key={i} />)}
 

          {!loading && (
            <>
              {/* ── SUMMARY CARDS ── */}
              {summary && (
                <div className="mk-grid-4 fade-up" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                  {[
                    { label:"Sentiment", value: summary.sentiment ?? "—",                  sub:`VIX: ${summary.vix ?? "—"}`,    cl: sentimentColor(summary.sentiment_color) },
                    { label:"Gold",      value:`$${summary.gold?.toLocaleString() ?? "—"}`, sub:"per oz",                        cl: AMB  },
                    { label:"Crude Oil", value:`$${summary.oil?.toLocaleString()  ?? "—"}`, sub:"per barrel",                    cl: AMB  },
                    { label:"USD / INR", value:`₹${summary.usdinr ?? "—"}`,                sub:"exchange rate",                  cl: T2   },
                  ].map(card => (
                    <Card key={card.label} style={{ padding:"14px 16px" }}>
                      <div style={{ fontSize:10, color:T3, letterSpacing:"0.06em", marginBottom:6 }}>{card.label.toUpperCase()}</div>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(16px,2.5vw,22px)", color:card.cl, letterSpacing:"-0.02em", lineHeight:1, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {card.value}
                      </div>
                      <div style={{ fontSize:11, color:T3 }}>{card.sub}</div>
                    </Card>
                  ))}
                </div>
              )}

              {/* ── GLOBAL INDICES ── */}
              {indices.length > 0 && (
                <Card className="fade-up" style={{ overflow:"hidden" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                    <SectionLabel>Global Indices</SectionLabel>
                    <span style={{ fontSize:11, color:T3 }}>Refreshed on load</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
                    {indices.map((idx, i) => (
                      <div key={i} className="idx-cell">
                        <div style={{ fontSize:11, color:T3, marginBottom:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{idx.name}</div>
                        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(14px,2vw,18px)", color:T1, letterSpacing:"-0.02em", marginBottom:4 }}>
                          {idx.price.toLocaleString("en-IN")}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <span style={{ fontSize:11, fontWeight:500, color: idx.change>=0?UP:DN }}>
                            {idx.change>=0?"▲":"▼"} {Math.abs(idx.change)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── GAINERS & LOSERS ── */}
              <div className="mk-grid-2 fade-up" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { title:"Top Gainers", data:liveGainers, up:true  },
                  { title:"Top Losers",  data:liveLosers,  up:false },
                ].map(({ title, data, up }) => (
                  <Card key={title} style={{ overflow:"hidden" }}>
                    {/* Card header */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                      <span style={{ fontSize:12, color:up?UP:DN }}>{up?"▲":"▼"}</span>
                      <SectionLabel>{title}</SectionLabel>
                      {marketStatus?.is_live && connected && (
                        <span className="live-dot" style={{ marginLeft:"auto" }}/>
                      )}
                    </div>

                    {/* Rows */}
                    <div>
                      {data.map((stock, i) => {
                        const prev = prevPrices[stock.ticker];
                        return (
                          <div key={i} className="mover-row" onClick={() => router.push("/charts")}>
                            <div style={{ flex:1, minWidth:0, marginRight:12 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                                <span style={{ fontSize:13, fontWeight:500, color:T1 }}>{stock.ticker}</span>
                                {marketStatus?.is_live && connected && (
                                  <span style={{ width:5, height:5, borderRadius:"50%", background:UP, display:"inline-block", animation:"pulse-d 1.8s ease-in-out infinite", flexShrink:0 }}/>
                                )}
                              </div>
                              <div style={{ fontSize:11, color:T3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{stock.name}</div>
                            </div>
                            <div style={{ textAlign:"right", flexShrink:0 }}>
                              <PriceCell value={stock.price} prevValue={prev} className="text-sm font-medium" />
                              <div style={{ fontSize:11, fontWeight:500, color:up?UP:DN, marginTop:2 }}>
                                {up?"+":""}{stock.change}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* ── FOOTER ── */}
          {!loading && marketStatus && (
            <div style={{ textAlign:"center", fontSize:11, color:T3, paddingBottom:4 }}>
              {marketStatus.is_live
                ? connected
                  ? "⚡ Prices streaming via Angel One · Indices refresh on load"
                  : "Reconnecting to live feed…"
                : `Market closed · Opens ${marketStatus.market_open} IST weekdays`}
            </div>
          )}

        </div>
      </>
    );
  }