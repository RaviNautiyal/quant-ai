"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter }       from "next/navigation";
import { FiRefreshCw, FiPlus, FiTrash2, FiBarChart2 } from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge, MarketClosedBanner, PriceCell } from "@/hooks/MarketUI";
import { useLivePrices }   from "@/hooks/useLivePrices";
import { apiFetch, apiPost, apiDelete } from "@/lib/apiFetch";
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

interface WatchStock {
  ticker: string; name: string; price: number;
  change_1d: number; volume: number; market_cap: number;
}

const formatMCap = (cap: number) => {
  if (!cap) return "—";
  if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9)  return `₹${(cap / 1e9).toFixed(1)}B`;
  return `₹${(cap / 1e6).toFixed(1)}M`;
};

/* ─── Shared components ─────────────────────────────────────────── */
function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ background: CARD, border: `0.5px solid ${BDR}`, borderRadius: 12, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", color: T3, textTransform: "uppercase" }}>{children}</div>;
}

function Badge({ children, color = "neu" }: { children: React.ReactNode; color?: "up"|"dn"|"neu" }) {
  const bg  = color==="up"?UP_BG  : color==="dn"?DN_BG  : "rgba(255,255,255,0.05)";
  const bdr = color==="up"?UP_BDR : color==="dn"?DN_BDR : BDR;
  const cl  = color==="up"?UP     : color==="dn"?DN     : T3;
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, background:bg, border:`0.5px solid ${bdr}`, color:cl, letterSpacing:"0.04em" }}>{children}</span>;
}

/* ════════════════════════════════════════════════════════════════ */
export default function WatchlistPage() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const [stocks,      setStocks]      = useState<WatchStock[]>([]);
  const [ticker,      setTicker]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [fetching,    setFetching]    = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchWatchlist = useCallback(async () => {
    setFetching(true);
    try {
      const data = await apiFetch("/watchlist/all");
      setStocks(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) { console.error(err); }
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchWatchlist();
  }, []);

  const { prices, prevPrices, connected } = useLivePrices(stocks.map(s => s.ticker), !!marketStatus?.is_live);

  const addToWatchlist = async () => {
    if (!ticker) return;
    setLoading(true);
    try {
      await apiPost("/watchlist/add", { ticker: ticker.toUpperCase() });
      setTicker("");
      fetchWatchlist();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const remove = async (t: string) => {
    try { await apiDelete(`/watchlist/remove/${t}`); fetchWatchlist(); } catch (err) { console.error(err); }
  };

  return (
    <>
      <ParticleCanvas />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111111; overflow-x: clip; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fade-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-d { 0%,100%{opacity:1;} 50%{opacity:.35;} }

        .fade-up  { animation: fade-up .35s ease-out both; }
        .live-dot { width:6px; height:6px; border-radius:50%; background:${UP}; display:inline-block; animation:pulse-d 1.8s ease-in-out infinite; }

        .wl-input {
          background: ${SURF}; border: 0.5px solid ${BDR}; color: ${T1};
          padding: 10px 14px; border-radius: 8px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; outline: none;
          transition: border-color .2s; text-transform: uppercase; letter-spacing: 0.05em;
          flex: 1;
        }
        .wl-input::placeholder { color: ${T3}; text-transform: none; letter-spacing: 0; }
        .wl-input:focus { border-color: ${T2}; }

        .wl-add-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: 8px;
          background: ${T1}; color: ${BG}; border: none;
          font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: opacity .15s, transform .15s; white-space: nowrap;
        }
        .wl-add-btn:hover { opacity: .88; transform: translateY(-1px); }
        .wl-add-btn:disabled { opacity: .4; cursor: not-allowed; }

        /* Table */
        .wl-table { width: 100%; border-collapse: collapse; font-family: 'DM Sans', sans-serif; }
        .wl-table th { text-align: left; padding: 10px 16px; font-size: 10px; font-weight: 500; letter-spacing: 0.07em; color: ${T3}; text-transform: uppercase; border-bottom: 0.5px solid ${BDR}; }
        .wl-table td { padding: 13px 16px; font-size: 13px; color: ${T2}; border-bottom: 0.5px solid ${BDR}; vertical-align: middle; }
        .wl-table tr:last-child td { border-bottom: none; }
        .wl-table tbody tr { transition: background .15s; }
        .wl-table tbody tr:hover { background: rgba(255,255,255,0.02); }

        /* Action buttons */
        .analyze-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 6px;
          background: ${UP_BG}; border: 0.5px solid ${UP_BDR}; color: ${UP};
          font-size: 11px; font-weight: 500; font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: opacity .15s;
        }
        .analyze-btn:hover { opacity: .8; }

        .remove-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 6px;
          background: transparent; border: 0.5px solid ${BDR}; color: ${T3};
          cursor: pointer; transition: border-color .15s, color .15s;
        }
        .remove-btn:hover { border-color: ${DN_BDR}; color: ${DN}; background: ${DN_BG}; }

        @media (max-width: 768px) {
          .wl-desktop { display: none !important; }
          .wl-header  { flex-direction: column !important; align-items: flex-start !important; }
        }
        @media (min-width: 769px) {
          .wl-mobile { display: none !important; }
        }
      `}</style>

      <div style={{ position:"relative", zIndex:4, minHeight:"100vh", padding:"20px 24px", fontFamily:"'DM Sans',sans-serif", color:T1, display:"flex", flexDirection:"column", gap:12 }}>

        {/* ── HEADER ── */}
        <div className="wl-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
              <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:"clamp(20px,3vw,26px)", color:T1, letterSpacing:"-0.02em", lineHeight:1 }}>Watchlist</h1>
              <MarketBadge status={marketStatus} />
              {marketStatus?.is_live && (
                <Badge color={connected?"up":"neu"}>{connected?"⚡ Streaming":"⟳ Connecting…"}</Badge>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <p style={{ fontSize:12, color:T3 }}>Monitor your favourite stocks in real time</p>
              {lastUpdated && (
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T3 }}>
                  <FiRefreshCw size={11} style={{ animation:fetching?"spin .7s linear infinite":"none", color:fetching?UP:T3 }}/>
                  Loaded {lastUpdated.toLocaleTimeString("en-IN")}
                </div>
              )}
            </div>
          </div>
        </div>

        <MarketClosedBanner status={marketStatus} />

        {/* ── ADD STOCK ── */}
        <Card style={{ padding:"14px 16px" }}>
          <div style={{ fontSize:12, fontWeight:500, color:T2, marginBottom:10 }}>Add to Watchlist</div>
          <div style={{ display:"flex", gap:8 }}>
            <input
              className="wl-input"
              placeholder="e.g. RELIANCE"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addToWatchlist()}
            />
            <button className="wl-add-btn" disabled={loading || !ticker} onClick={addToWatchlist}>
              <FiPlus size={13}/>
              {loading ? "Adding…" : "Add"}
            </button>
          </div>
        </Card>

        {/* ── STOCK LIST ── */}
        <Card className="fade-up" style={{ overflow:"hidden" }}>
          {/* Header */}
          <div style={{ padding:"13px 16px", borderBottom:`0.5px solid ${BDR}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <SectionLabel>
              Watching {stocks.length} stock{stocks.length !== 1 ? "s" : ""}
            </SectionLabel>
            {marketStatus?.is_live && connected && (
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span className="live-dot"/>
                <span style={{ fontSize:11, color:UP }}>Live</span>
              </div>
            )}
          </div>

          {/* Empty state */}
          {stocks.length === 0 ? (
            <div style={{ padding:"48px 24px", textAlign:"center" }}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:36, color:SURF, marginBottom:10 }}>◎</div>
              <div style={{ fontSize:14, color:T2, marginBottom:4 }}>Your watchlist is empty</div>
              <div style={{ fontSize:12, color:T3 }}>Add stocks above to start monitoring</div>
            </div>
          ) : (
            <>
              {/* ── Desktop table ── */}
              <div className="wl-desktop" style={{ overflowX:"auto" }}>
                <table className="wl-table">
                  <thead>
                    <tr>
                      {["Stock","Live Price","1D Change","Market Cap","Volume",""].map(h=>(
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map(stock => {
                      const livePrice = prices[stock.ticker] ?? stock.price;
                      const prevPrice = prevPrices[stock.ticker];
                      const up = stock.change_1d >= 0;
                      return (
                        <tr key={stock.ticker}>
                          {/* Ticker + name */}
                          <td>
                            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
                              <span style={{ fontSize:13, fontWeight:500, color:UP }}>{stock.ticker}</span>
                              {marketStatus?.is_live && connected && <span className="live-dot"/>}
                            </div>
                            <div style={{ fontSize:11, color:T3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 }}>{stock.name}</div>
                          </td>
                          {/* Live price */}
                          <td style={{ color:T1, fontWeight:500 }}>
                            <PriceCell value={livePrice} prevValue={prevPrice}/>
                          </td>
                          {/* 1D change */}
                          <td>
                            <Badge color={up?"up":"dn"}>
                              {up?"▲":"▼"} {Math.abs(stock.change_1d).toFixed(2)}%
                            </Badge>
                          </td>
                          {/* Market cap */}
                          <td style={{ color:T3 }}>{formatMCap(stock.market_cap)}</td>
                          {/* Volume */}
                          <td style={{ color:T3 }}>
                            {stock.volume ? stock.volume.toLocaleString("en-IN") : "—"}
                          </td>
                          {/* Actions */}
                          <td>
                            <div style={{ display:"flex", gap:6, justifyContent:"flex-end", alignItems:"center" }}>
                              <button className="analyze-btn" onClick={() => router.push("/analysis")}>
                                <FiBarChart2 size={11}/> Analyse
                              </button>
                              <button className="remove-btn" onClick={() => remove(stock.ticker)}>
                                <FiTrash2 size={12}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile cards ── */}
              <div className="wl-mobile" style={{ display:"flex", flexDirection:"column" }}>
                {stocks.map(stock => {
                  const livePrice = prices[stock.ticker] ?? stock.price;
                  const prevPrice = prevPrices[stock.ticker];
                  const up = stock.change_1d >= 0;
                  return (
                    <div key={stock.ticker} style={{ padding:"14px 16px", borderBottom:`0.5px solid ${BDR}` }}>
                      {/* Header row */}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                            <span style={{ fontSize:14, fontWeight:500, color:UP }}>{stock.ticker}</span>
                            {marketStatus?.is_live && connected && <span className="live-dot"/>}
                          </div>
                          <div style={{ fontSize:11, color:T3, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{stock.name}</div>
                        </div>
                        <Badge color={up?"up":"dn"}>{up?"▲":"▼"} {Math.abs(stock.change_1d).toFixed(2)}%</Badge>
                      </div>

                      {/* Data row */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                        {[
                          { label:"Live Price",  value:<PriceCell value={livePrice} prevValue={prevPrice}/> },
                          { label:"Market Cap",  value:<span style={{ fontSize:12, color:T3 }}>{formatMCap(stock.market_cap)}</span> },
                          { label:"Volume",      value:<span style={{ fontSize:12, color:T3 }}>{stock.volume ? stock.volume.toLocaleString("en-IN") : "—"}</span> },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize:10, color:T3, letterSpacing:"0.05em", marginBottom:3 }}>{label.toUpperCase()}</div>
                            <div>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="analyze-btn" style={{ flex:1, justifyContent:"center" }} onClick={() => router.push("/analysis")}>
                          <FiBarChart2 size={11}/> Analyse
                        </button>
                        <button
                          onClick={() => remove(stock.ticker)}
                          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, flex:1, padding:"7px", borderRadius:7, background:DN_BG, border:`0.5px solid ${DN_BDR}`, color:DN, fontSize:12, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}
                        >
                          <FiTrash2 size={12}/> Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {/* ── FOOTER ── */}
        {stocks.length > 0 && marketStatus && (
          <div style={{ textAlign:"center", fontSize:11, color:T3, paddingBottom:4 }}>
            {marketStatus.is_live
              ? connected ? "⚡ Streaming live prices via Angel One WebSocket" : "Reconnecting to live feed…"
              : `Market closed · Opens ${marketStatus.market_open} IST weekdays`}
          </div>
        )}

      </div>
    </>
  );
}