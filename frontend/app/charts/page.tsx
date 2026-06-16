"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area,
} from "recharts";
import {
  FiRefreshCw, FiMinus, FiTrendingUp,
  FiSquare, FiCircle, FiCrosshair, FiTrash2,
} from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge } from "@/hooks/MarketUI";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import ParticleCanvas from "@/components/ParticleCanvas";

/* ─── Tokens ─────────────────────────────────────────────────────── */
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

const TIMEFRAMES = [
  {label:"1D",value:"1d"},{label:"1W",value:"1w"},
  {label:"1M",value:"1m"},{label:"3M",value:"3m"},
  {label:"6M",value:"6m"},{label:"1Y",value:"1y"},
  {label:"3Y",value:"3y"},{label:"5Y",value:"5y"},
];
const CHART_TYPES = [
  {label:"Line",value:"line"},
  {label:"Area",value:"area"},
  {label:"Candle",value:"candle"},
];
const INDICATORS = [
  {label:"EMA 20",value:"ema20"},{label:"EMA 50",value:"ema50"},
  {label:"EMA 200",value:"ema200"},{label:"Bollinger",value:"bb"},
  {label:"Volume",value:"volume"},{label:"RSI",value:"rsi"},
  {label:"MACD",value:"macd"},
];
const DRAW_TOOLS = [
  {label:"Crosshair",value:"crosshair",icon:FiCrosshair},
  {label:"H-Line",value:"hline",icon:FiMinus},
  {label:"Trend",value:"trendline",icon:FiTrendingUp},
  {label:"Rect",value:"rect",icon:FiSquare},
  {label:"Ellipse",value:"ellipse",icon:FiCircle},
];
const QUICK = ["RELIANCE","TCS","HDFCBANK","INFY","SBIN","ADANIENT","WIPRO","ICICIBANK","BAJFINANCE","KOTAKBANK"];
const IND_COLORS: Record<string,string> = {
  ema20:"#60a5fa", ema50:"#a78bfa", ema200:"#f472b6",
};

interface Candle {
  date:string; open:number; high:number; low:number; close:number; volume:number;
  ema20?:number; ema50?:number; ema200?:number;
  bb_upper?:number; bb_lower?:number; bb_mid?:number;
  rsi?:number; macd?:number; macd_signal?:number; macd_hist?:number;
}
interface Drawing {
  id:string; tool:string; x1:number; y1:number; x2?:number; y2?:number; color:string;
}

function Card({children,style,className}:{children:React.ReactNode;style?:React.CSSProperties;className?:string}) {
  return <div className={className} style={{background:CARD,border:`0.5px solid ${BDR}`,borderRadius:12,backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",...style}}>{children}</div>;
}
function SLabel({children}:{children:React.ReactNode}) {
  return <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.07em",color:T3,textTransform:"uppercase"}}>{children}</div>;
}
function Skel({w="100%",h=16}:{w?:string|number;h?:number}) {
  return <div className="skel" style={{width:w,height:h,borderRadius:6}}/>;
}

/* ══════════════════════════════════════════════════════════════════
   PURE CANVAS CANDLESTICK CHART
══════════════════════════════════════════════════════════════════ */
function CandleCanvas({candles,indicators}:{candles:Candle[];indicators:string[]}) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{x:number;y:number;c:Candle}|null>(null);
  const [dims, setDims] = useState({w:0,h:340});

  /* Measure wrapper */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({w: el.clientWidth, h: 340});
    });
    ro.observe(el);
    setDims({w: el.clientWidth, h: 340});
    return () => ro.disconnect();
  }, []);

  /* Draw */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles.length || dims.w <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = dims.w * dpr;
    canvas.height = dims.h * dpr;
    canvas.style.width  = dims.w + "px";
    canvas.style.height = dims.h + "px";

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dims.w, dims.h);

    const PL = 10, PR = 68, PT = 14, PB = 32;
    const W  = dims.w - PL - PR;
    const H  = dims.h - PT - PB;
    const N  = candles.length;

    /* Price range from OHLC */
    let pMax = -Infinity, pMin = Infinity;
    candles.forEach(c => {
      pMax = Math.max(pMax, c.high);
      pMin = Math.min(pMin, c.low);
      if (indicators.includes("bb")) {
        if (c.bb_upper) pMax = Math.max(pMax, c.bb_upper);
        if (c.bb_lower) pMin = Math.min(pMin, c.bb_lower);
      }
    });
    const margin = (pMax - pMin) * 0.06;
    pMax += margin; pMin -= margin;
    const pRange = pMax - pMin || 1;

    const toY = (p:number) => PT + H - ((p - pMin) / pRange) * H;
    const toX = (i:number) => PL + (i + 0.5) * (W / N);

    /* ── Grid ── */
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = PT + (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + W, y); ctx.stroke();
    }

    /* ── Y labels ── */
    ctx.fillStyle  = T3;
    ctx.font       = "10px DM Sans,sans-serif";
    ctx.textAlign  = "left";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const price = pMax - (pRange / 4) * i;
      const y     = PT + (H / 4) * i;
      ctx.fillText("₹" + price.toLocaleString("en-IN",{maximumFractionDigits:0}), PL + W + 6, y);
    }

    /* ── X labels ── */
    ctx.textAlign    = "center";
    ctx.textBaseline = "alphabetic";
    const step = Math.max(1, Math.floor(N / 7));
    candles.forEach((c, i) => {
      if (i % step !== 0) return;
      ctx.fillStyle = T3;
      ctx.fillText(c.date, toX(i), dims.h - 8);
    });

    /* ── EMA lines ── */
    function drawLineIndicator(key:keyof Candle, color:string, dash:number[]=[]) {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      candles.forEach((c,i) => {
        const v = c[key] as number|undefined;
        if (v == null || isNaN(v)) return;
        const x = toX(i), y = toY(v);
        if (!started) { ctx.moveTo(x,y); started=true; } else ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (indicators.includes("ema20"))  drawLineIndicator("ema20",  IND_COLORS.ema20);
    if (indicators.includes("ema50"))  drawLineIndicator("ema50",  IND_COLORS.ema50);
    if (indicators.includes("ema200")) drawLineIndicator("ema200", IND_COLORS.ema200);
    if (indicators.includes("bb") && candles.some(c=>c.bb_upper)) {
      drawLineIndicator("bb_upper","rgba(196,148,58,0.55)",[4,3]);
      drawLineIndicator("bb_lower","rgba(196,148,58,0.55)",[4,3]);
      drawLineIndicator("bb_mid","rgba(196,148,58,0.25)");
    }

    /* ── Candlesticks ── */
    const rawBarW = (W / N) * 0.7;
    const barW    = Math.max(1, Math.min(rawBarW, 20));

    candles.forEach((c, i) => {
      const cx    = toX(i);
      const x     = cx - barW / 2;
      const isUp  = c.close >= c.open;
      const color = isUp ? UP : DN;

      const yH = toY(c.high);
      const yL = toY(c.low);
      const yO = toY(c.open);
      const yC = toY(c.close);

      const bodyTop = Math.min(yO, yC);
      const bodyH   = Math.max(Math.abs(yC - yO), 1.5);

      /* Upper wick */
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(cx, yH); ctx.lineTo(cx, bodyTop); ctx.stroke();

      /* Body */
      if (isUp) {
        ctx.fillStyle = UP;
        ctx.fillRect(x, bodyTop, barW, bodyH);
        ctx.strokeStyle = "#2daa5a";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, bodyTop, barW, bodyH);
      } else {
        ctx.fillStyle = DN;
        ctx.fillRect(x, bodyTop, barW, bodyH);
        ctx.strokeStyle = "#d04444";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, bodyTop, barW, bodyH);
      }

      /* Lower wick */
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(cx, bodyTop + bodyH); ctx.lineTo(cx, yL); ctx.stroke();
    });

  }, [candles, dims, indicators]);

  /* Tooltip on hover */
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !candles.length) return;
    const mx   = e.clientX - rect.left;
    const N    = candles.length;
    const PL   = 10, PR = 68;
    const W    = dims.w - PL - PR;
    const barW = W / N;
    const idx  = Math.floor((mx - PL) / barW);
    const c    = candles[Math.max(0, Math.min(idx, N-1))];
    if (c) setTip({x: e.clientX - rect.left, y: e.clientY - rect.top, c});
  };

  return (
    <div ref={wrapRef} style={{width:"100%",position:"relative"}}>
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseLeave={()=>setTip(null)}
        style={{display:"block",cursor:"crosshair"}}
      />
      {tip&&(
        <div style={{
          position:"absolute",
          left: tip.x > dims.w*0.65 ? tip.x-175 : tip.x+14,
          top:  Math.max(8, tip.y-80),
          background:"#1a1a1a",border:`0.5px solid ${BDR}`,
          borderRadius:9,padding:"10px 14px",
          fontSize:11,fontFamily:"'DM Sans',sans-serif",
          pointerEvents:"none",zIndex:20,minWidth:160,
        }}>
          <div style={{color:T3,marginBottom:6,fontSize:10,letterSpacing:"0.03em"}}>{tip.c.date}</div>
          {([["O",tip.c.open],["H",tip.c.high],["L",tip.c.low],["C",tip.c.close]] as [string,number][]).map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:3}}>
              <span style={{color:T3}}>{k}</span>
              <span style={{color:k==="C"?(tip.c.close>=tip.c.open?UP:DN):T1,fontWeight:k==="C"?600:400}}>
                ₹{v?.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
              </span>
            </div>
          ))}
          {tip.c.volume>0&&(
            <div style={{color:T3,marginTop:5,fontSize:10,borderTop:`0.5px solid ${BDR}`,paddingTop:5}}>
              Vol: {(tip.c.volume/1e6).toFixed(2)}M
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Recharts tooltip ───────────────────────────────────────────── */
const ChartTooltip = ({active,payload,label}:any) => {
  if (!active||!payload?.length) return null;
  const d = payload[0]?.payload as Candle;
  if (!d) return null;
  return (
    <div style={{background:"#1a1a1a",border:`0.5px solid ${BDR}`,borderRadius:8,padding:"9px 13px",fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{color:T3,marginBottom:4,fontSize:10}}>{label}</div>
      <div style={{color:T1,fontWeight:500}}>₹{d.close?.toLocaleString("en-IN",{minimumFractionDigits:2})}</div>
      {d.volume>0&&<div style={{color:T3,marginTop:3,fontSize:10}}>Vol: {(d.volume/1e6).toFixed(2)}M</div>}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════ */
function ChartsInner() {
  const params       = useSearchParams();
  const marketStatus = useMarketStatus();

  const [ticker,     setTicker]     = useState(params?.get("ticker")||"RELIANCE");
  const [tickerInput,setTickerInput]= useState(params?.get("ticker")||"RELIANCE");
  const [timeframe,  setTimeframe]  = useState("3m");
  const [chartType,  setChartType]  = useState("area");
  const [indicators, setIndicators] = useState<string[]>(["ema20","volume"]);
  const [drawTool,   setDrawTool]   = useState("crosshair");
  const [drawColor,  setDrawColor]  = useState(AMB);
  const [drawings,   setDrawings]   = useState<Drawing[]>([]);
  const [candles,    setCandles]    = useState<Candle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  const [isDrawing,  setIsDrawing]  = useState(false);
  const [currentDraw,setCurrentDraw]= useState<Drawing|null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const showVolume = indicators.includes("volume");
  const showRSI    = indicators.includes("rsi");
  const showMACD   = indicators.includes("macd");

  const fetchChart = useCallback(async (sym:string, tf:string) => {
    setLoading(true); setError("");
    try {
      const data = await apiFetch(`/charts/ohlcv?ticker=${sym}&timeframe=${tf}&indicators=${indicators.join(",")}`);
      setCandles(Array.isArray(data) ? data : []);
    } catch(e) {
      setError(e instanceof ApiError ? e.message : "Failed to load chart data");
      setCandles([]);
    }
    setLoading(false);
  }, [indicators]);

  useEffect(()=>{ fetchChart(ticker, timeframe); }, [ticker, timeframe]);

  const handleSearch = () => {
    const sym = tickerInput.trim().toUpperCase();
    if (!sym) return;
    setTicker(sym); setDrawings([]);
  };
  const toggleInd = (ind:string) =>
    setIndicators(prev=>prev.includes(ind)?prev.filter(i=>i!==ind):[...prev,ind]);

  /* Drawing SVG */
  const getSVGPt = (e:React.MouseEvent) => {
    const r = chartRef.current?.getBoundingClientRect();
    return r ? {x:e.clientX-r.left, y:e.clientY-r.top} : {x:0,y:0};
  };
  const startDraw = (e:React.MouseEvent) => {
    if (drawTool==="crosshair") return;
    const pt=getSVGPt(e);
    setIsDrawing(true);
    setCurrentDraw({id:Date.now().toString(),tool:drawTool,x1:pt.x,y1:pt.y,color:drawColor});
  };
  const moveDraw = (e:React.MouseEvent) => {
    if (!isDrawing) return;
    const pt=getSVGPt(e);
    setCurrentDraw(prev=>prev?{...prev,x2:pt.x,y2:pt.y}:null);
  };
  const endDraw = () => {
    if (!isDrawing||!currentDraw) return;
    if (currentDraw.x2!==undefined) setDrawings(prev=>[...prev,currentDraw]);
    setIsDrawing(false); setCurrentDraw(null);
  };
  const renderD = (d:Drawing,preview=false) => {
    const k=preview?"prev":d.id,s=d.color,sw=1.5,op=preview?0.6:1;
    if (!d.x2||!d.y2) return null;
    switch(d.tool){
      case "hline":     return <line key={k} x1={0} y1={d.y1} x2="100%" y2={d.y1} stroke={s} strokeWidth={sw} strokeDasharray="4 2" opacity={op}/>;
      case "trendline": return <line key={k} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke={s} strokeWidth={sw} opacity={op}/>;
      case "rect":      return <rect key={k} x={Math.min(d.x1,d.x2)} y={Math.min(d.y1,d.y2)} width={Math.abs(d.x2-d.x1)} height={Math.abs(d.y2-d.y1)} stroke={s} strokeWidth={sw} fill={`${s}10`} opacity={op}/>;
      case "ellipse":   return <ellipse key={k} cx={(d.x1+d.x2)/2} cy={(d.y1+d.y2)/2} rx={Math.abs(d.x2-d.x1)/2} ry={Math.abs(d.y2-d.y1)/2} stroke={s} strokeWidth={sw} fill={`${s}10`} opacity={op}/>;
      default: return null;
    }
  };

  const last   = candles[candles.length-1];
  const first  = candles[0];
  const change = last&&first ? last.close-first.close : 0;
  const chgPct = first?.close ? (change/first.close)*100 : 0;

  return (
    <>
      <ParticleCanvas/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#111111;overflow-x:clip;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes shimmer{from{background-position:200% 0;}to{background-position:-200% 0;}}
        @keyframes fade-up{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        .skel{background:linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%);background-size:400% 100%;animation:shimmer 1.5s infinite;}
        .fade-up{animation:fade-up .35s ease-out both;}
        .tf-btn{padding:5px 10px;border-radius:6px;font-size:11px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .12s;background:transparent;border:0.5px solid transparent;color:${T3};white-space:nowrap;}
        .tf-btn.active{background:rgba(255,255,255,0.08);border-color:${BDR};color:${T1};}
        .tf-btn:hover:not(.active){color:${T2};}
        .ct-btn{padding:5px 14px;border-radius:6px;font-size:11px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .12s;background:transparent;border:0.5px solid transparent;color:${T3};}
        .ct-btn.active{background:${UP_BG};border-color:${UP_BDR};color:${UP};}
        .ct-btn:hover:not(.active){color:${T2};}
        .ind-btn{padding:4px 10px;border-radius:6px;font-size:10.5px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .12s;background:rgba(255,255,255,0.03);border:0.5px solid ${BDR};color:${T3};}
        .ind-btn.active{background:${AMB_BG};border-color:${AMB_BDR};color:${AMB};}
        .ind-btn:hover:not(.active){color:${T2};}
        .draw-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 10px;border-radius:7px;font-size:9px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .12s;background:transparent;border:0.5px solid transparent;color:${T3};min-width:42px;}
        .draw-btn.active{background:rgba(255,255,255,0.06);border-color:${BDR};color:${T1};}
        .draw-btn:hover:not(.active){color:${T2};}
        .ticker-input{background:rgba(255,255,255,0.04);border:0.5px solid ${BDR};border-radius:8px;padding:9px 14px;font-size:13px;color:${T1};outline:none;font-family:'DM Sans',sans-serif;transition:border-color .15s;text-transform:uppercase;letter-spacing:0.06em;width:140px;}
        .ticker-input::placeholder{color:${T3};text-transform:none;letter-spacing:normal;}
        .ticker-input:focus{border-color:rgba(255,255,255,0.18);}
        .go-btn{display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .15s;background:rgba(255,255,255,0.07);border:0.5px solid rgba(255,255,255,0.12);color:${T1};}
        .go-btn:hover{background:rgba(255,255,255,0.10);}
        .quick-btn{padding:4px 9px;border-radius:6px;font-size:11px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .12s;background:rgba(255,255,255,0.04);border:0.5px solid ${BDR};color:${T3};}
        .quick-btn:hover{color:${T1};border-color:rgba(255,255,255,0.15);}
        .quick-btn.active{color:${UP};border-color:${UP_BDR};background:${UP_BG};}
        .color-dot{width:15px;height:15px;border-radius:50%;cursor:pointer;flex-shrink:0;transition:box-shadow .12s;}
        .color-dot.active{box-shadow:0 0 0 2px rgba(255,255,255,0.5);}
        @media(max-width:768px){.ch-draw{display:none!important;}.ch-bar{flex-wrap:wrap!important;}}
      `}</style>

      <div style={{position:"relative",zIndex:4,minHeight:"100vh",padding:"20px 24px",fontFamily:"'DM Sans',sans-serif",color:T1,display:"flex",flexDirection:"column",gap:10}}>

        {/* ── HEADER ── */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4,flexWrap:"wrap"}}>
              <h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(20px,3vw,26px)",color:T1,letterSpacing:"-0.02em",lineHeight:1}}>Charts</h1>
              <MarketBadge status={marketStatus}/>
            </div>
            <p style={{fontSize:12,color:T3}}>Interactive charts · Drawing tools · Technical indicators</p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input className="ticker-input" value={tickerInput} placeholder="Symbol"
              onChange={e=>setTickerInput(e.target.value.toUpperCase())}
              onKeyDown={e=>e.key==="Enter"&&handleSearch()}/>
            <button className="go-btn" onClick={handleSearch}>
              <FiRefreshCw size={12} style={{animation:loading?"spin .7s linear infinite":"none"}}/>
              Load
            </button>
          </div>
        </div>

        {/* ── PRICE BAR ── */}
        <Card style={{padding:"12px 18px"}}>
          {loading ? (
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              <Skel w={100} h={28}/><Skel w={130} h={14}/><Skel w={80} h={14}/>
            </div>
          ) : last ? (
            <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:26,color:T1,letterSpacing:"-0.02em"}}>
                ₹{last.close.toLocaleString("en-IN",{minimumFractionDigits:2})}
              </span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:13,fontWeight:600,color:change>=0?UP:DN}}>{change>=0?"+":""}{change.toFixed(2)}</span>
                <span style={{fontSize:12,color:change>=0?UP:DN}}>({chgPct>=0?"+":""}{chgPct.toFixed(2)}%)</span>
                <span style={{fontSize:11,color:T3}}>in period</span>
              </div>
              <div style={{display:"flex",gap:18,marginLeft:"auto"}}>
                {[["H",`₹${last.high.toLocaleString("en-IN",{minimumFractionDigits:2})}`],
                  ["L",`₹${last.low.toLocaleString("en-IN",{minimumFractionDigits:2})}`],
                  ["Vol",last.volume?(last.volume/1e6).toFixed(1)+"M":"—"]].map(([l,v])=>(
                  <div key={l} style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:T3,letterSpacing:"0.06em",textTransform:"uppercase"}}>{l}</div>
                    <div style={{fontSize:12,color:T2,marginTop:1}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {/* ── QUICK PICKS ── */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <SLabel>Quick</SLabel>
          {QUICK.map(q=>(
            <button key={q} className={`quick-btn${ticker===q?" active":""}`}
              onClick={()=>{setTicker(q);setTickerInput(q);setDrawings([]);}}>
              {q}
            </button>
          ))}
        </div>

        {/* ── CHART CARD ── */}
        <Card className="fade-up" style={{overflow:"hidden"}}>

          {/* ── Toolbar ── */}
          <div className="ch-bar" style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:`0.5px solid ${BDR}`,flexWrap:"wrap"}}>
            {/* Timeframes */}
            <div style={{display:"flex",gap:2}}>
              {TIMEFRAMES.map(tf=>(
                <button key={tf.value} className={`tf-btn${timeframe===tf.value?" active":""}`}
                  onClick={()=>setTimeframe(tf.value)}>{tf.label}</button>
              ))}
            </div>
            <div style={{width:"0.5px",height:18,background:BDR}}/>
            {/* Chart type */}
            <div style={{display:"flex",gap:2}}>
              {CHART_TYPES.map(ct=>(
                <button key={ct.value} className={`ct-btn${chartType===ct.value?" active":""}`}
                  onClick={()=>setChartType(ct.value)}>{ct.label}</button>
              ))}
            </div>
            <div style={{width:"0.5px",height:18,background:BDR}}/>
            {/* Indicators */}
            <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
              {INDICATORS.map(ind=>(
                <button key={ind.value} className={`ind-btn${indicators.includes(ind.value)?" active":""}`}
                  onClick={()=>toggleInd(ind.value)}>{ind.label}</button>
              ))}
            </div>
            <button onClick={()=>fetchChart(ticker,timeframe)}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,background:"transparent",border:`0.5px solid ${BDR}`,color:T3,fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>
              <FiRefreshCw size={11} style={{animation:loading?"spin .7s linear infinite":"none"}}/>
            </button>
          </div>

          {/* ── Drawing bar ── */}
          <div className="ch-draw" style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",borderBottom:`0.5px solid ${BDR}`,background:"rgba(255,255,255,0.01)"}}>
            <SLabel>Draw</SLabel>
            <div style={{display:"flex",gap:3}}>
              {DRAW_TOOLS.map(dt=>{
                const Icon=dt.icon;
                return (
                  <button key={dt.value} className={`draw-btn${drawTool===dt.value?" active":""}`}
                    onClick={()=>setDrawTool(dt.value)}>
                    <Icon size={13}/><span>{dt.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{width:"0.5px",height:18,background:BDR,margin:"0 4px"}}/>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              {[AMB,UP,DN,"#60a5fa","#f0f0ee"].map(c=>(
                <div key={c} className={`color-dot${drawColor===c?" active":""}`}
                  style={{background:c}} onClick={()=>setDrawColor(c)}/>
              ))}
            </div>
            {drawings.length>0&&(
              <button onClick={()=>setDrawings([])}
                style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:6,background:DN_BG,border:`0.5px solid ${DN_BDR}`,color:DN,fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>
                <FiTrash2 size={11}/>Clear ({drawings.length})
              </button>
            )}
          </div>

          {/* ── Chart body ── */}
          <div ref={chartRef} style={{position:"relative"}}>

            {/* Error */}
            {error&&(
              <div style={{margin:"14px 16px",fontSize:12,color:DN,background:DN_BG,border:`0.5px solid ${DN_BDR}`,borderRadius:8,padding:"9px 14px"}}>{error}</div>
            )}

            {/* Loading */}
            {loading&&(
              <div style={{padding:"20px 16px",display:"flex",flexDirection:"column",gap:7}}>
                {[100,78,90,65,85,70,95,60].map((w,i)=><Skel key={i} w={`${w}%`} h={i===0?22:12}/>)}
              </div>
            )}

            {!loading&&candles.length===0&&!error&&(
              <div style={{padding:"60px 24px",textAlign:"center",color:T3,fontSize:13}}>
                No chart data returned. Check the ticker symbol and try again.
              </div>
            )}

            {!loading&&candles.length>0&&(
              <>
                {/* ── CANDLE: pure canvas ── */}
                {chartType==="candle"&&(
                  <CandleCanvas candles={candles} indicators={indicators}/>
                )}

                {/* ── LINE / AREA: Recharts ── */}
                {chartType!=="candle"&&(
                  <ResponsiveContainer width="100%" height={340}>
                    <ComposedChart data={candles} margin={{left:0,right:64,top:10,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                      <XAxis dataKey="date" tick={{fill:T3,fontSize:9}} interval={Math.floor(candles.length/7)} tickLine={false} axisLine={false}/>
                      <YAxis orientation="right" tick={{fill:T3,fontSize:9}} tickLine={false} axisLine={false}
                        tickFormatter={v=>`₹${v.toLocaleString("en-IN",{maximumFractionDigits:0})}`} domain={["auto","auto"]} width={60}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      {indicators.includes("bb")&&candles[0]?.bb_upper&&<>
                        <Line type="monotone" dataKey="bb_upper" stroke="rgba(196,148,58,0.45)" dot={false} strokeWidth={1} strokeDasharray="3 2"/>
                        <Line type="monotone" dataKey="bb_lower" stroke="rgba(196,148,58,0.45)" dot={false} strokeWidth={1} strokeDasharray="3 2"/>
                        <Line type="monotone" dataKey="bb_mid"   stroke="rgba(196,148,58,0.22)" dot={false} strokeWidth={1}/>
                      </>}
                      {indicators.includes("ema20")  &&<Line type="monotone" dataKey="ema20"  stroke={IND_COLORS.ema20}  dot={false} strokeWidth={1.2}/>}
                      {indicators.includes("ema50")  &&<Line type="monotone" dataKey="ema50"  stroke={IND_COLORS.ema50}  dot={false} strokeWidth={1.2}/>}
                      {indicators.includes("ema200") &&<Line type="monotone" dataKey="ema200" stroke={IND_COLORS.ema200} dot={false} strokeWidth={1.2}/>}
                      {chartType==="area"&&<Area type="monotone" dataKey="close" stroke={UP} fill={UP_BG} strokeWidth={1.5} dot={false}/>}
                      {chartType==="line"&&<Line type="monotone" dataKey="close" stroke={UP} strokeWidth={1.5} dot={false}/>}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}

                {/* ── Volume sub ── */}
                {showVolume&&(
                  <ResponsiveContainer width="100%" height={58}>
                    <ComposedChart data={candles} margin={{left:0,right:64,top:0,bottom:0}}>
                      <XAxis dataKey="date" hide/>
                      <YAxis orientation="right" tick={{fill:T3,fontSize:8}} tickLine={false} axisLine={false}
                        tickFormatter={v=>`${(v/1e6).toFixed(0)}M`} width={60}/>
                      {candles.map((c,i)=>{
                        /* We render volume bars manually coloured by close vs open */
                        return null; // Recharts Bar below handles it
                      })}
                      <Area type="monotone" dataKey="volume" stroke="transparent"
                        fill="rgba(255,255,255,0.07)" isAnimationActive={false}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                )}

                {/* ── RSI sub ── */}
                {showRSI&&candles[0]?.rsi!=null&&(
                  <ResponsiveContainer width="100%" height={78}>
                    <ComposedChart data={candles} margin={{left:0,right:64,top:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false}/>
                      <XAxis dataKey="date" hide/>
                      <YAxis orientation="right" domain={[0,100]} tick={{fill:T3,fontSize:8}} tickLine={false} axisLine={false} ticks={[30,50,70]} width={60}/>
                      <ReferenceLine y={70} stroke={`${DN}55`} strokeDasharray="3 2"/>
                      <ReferenceLine y={30} stroke={`${UP}55`} strokeDasharray="3 2"/>
                      <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.2} dot={false}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                )}

                {/* ── MACD sub ── */}
                {showMACD&&candles[0]?.macd!=null&&(
                  <ResponsiveContainer width="100%" height={78}>
                    <ComposedChart data={candles} margin={{left:0,right:64,top:0,bottom:6}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false}/>
                      <XAxis dataKey="date" tick={{fill:T3,fontSize:8}} interval={Math.floor(candles.length/7)} tickLine={false} axisLine={false}/>
                      <YAxis orientation="right" tick={{fill:T3,fontSize:8}} tickLine={false} axisLine={false} width={60}/>
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.10)"/>
                      <Line type="monotone" dataKey="macd"        stroke={UP} strokeWidth={1} dot={false}/>
                      <Line type="monotone" dataKey="macd_signal" stroke={DN} strokeWidth={1} dot={false}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </>
            )}

            {/* ── SVG drawing overlay ── */}
            <svg
              style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:drawTool==="crosshair"?"none":"all",cursor:drawTool==="crosshair"?"default":"crosshair"}}
              onMouseDown={startDraw} onMouseMove={moveDraw}
              onMouseUp={endDraw} onMouseLeave={endDraw}>
              {drawings.map(d=>renderD(d))}
              {currentDraw&&renderD(currentDraw,true)}
            </svg>
          </div>

          {/* ── Legend ── */}
          {indicators.length>0&&(
            <div style={{display:"flex",gap:14,padding:"8px 14px",borderTop:`0.5px solid ${BDR}`,flexWrap:"wrap"}}>
              {[
                {k:"ema20",l:"EMA 20",c:IND_COLORS.ema20},
                {k:"ema50",l:"EMA 50",c:IND_COLORS.ema50},
                {k:"ema200",l:"EMA 200",c:IND_COLORS.ema200},
                {k:"bb",l:"Bollinger",c:AMB},
                {k:"rsi",l:"RSI",c:"#a78bfa"},
                {k:"macd",l:"MACD",c:T2},
              ].filter(x=>indicators.includes(x.k)).map(x=>(
                <div key={x.k} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:x.c}}>
                  <span style={{width:14,height:2,background:x.c,display:"inline-block",borderRadius:1}}/>
                  {x.l}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div style={{textAlign:"center",fontSize:11,color:T3,paddingBottom:4}}>
          Chart data via yfinance · Drawings are session-only
        </div>
      </div>
    </>
  );
}

/* ── Suspense wrapper — required by Next.js App Router for useSearchParams ── */
export default function ChartsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100vh", background:"#111111", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:28, height:28, border:"2px solid rgba(61,186,106,0.2)", borderTopColor:"#3dba6a", borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    }>
      <ChartsInner />
    </Suspense>
  );
}