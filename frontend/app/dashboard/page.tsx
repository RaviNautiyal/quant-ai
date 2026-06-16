"use client";
import { SkeletonStatCard, SkeletonTableRow, SkeletonChartCard, SkeletonMoverRow, PageLoader, Skel } from "@/components/Skeletons";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { useLivePrices }   from "@/hooks/useLivePrices";
import { apiFetch, apiPost } from "@/lib/apiFetch";
import ParticleCanvas from "@/components/ParticleCanvas";

/* ─── Design tokens (match landing page) ───────────────────────── */
const BG   = "#111111";
const CARD = "rgba(26,26,26,0.82)";
const SURF = "#222222";
const BDR  = "#2c2c2c";
const BDRS = "#252525";
const T1   = "#f0f0ee";
const T2   = "#888884";
const T3   = "#555552";
const UP   = "#3dba6a";
const DN   = "#e05555";
const AMB  = "#c4943a";
const UP_BG  = "rgba(61,186,106,0.10)";
const DN_BG  = "rgba(224,85,85,0.10)";
const AMB_BG = "rgba(196,148,58,0.10)";

const FEATURED = ["RELIANCE","TCS","INFY","HDFCBANK","WIPRO","ADANIENT"];
const FALLBACK: Record<string,{vol:string;mcap:string}> = {
  RELIANCE:{vol:"12.4M",mcap:"₹19.9L Cr"},
  TCS:     {vol:"3.1M", mcap:"₹14.9L Cr"},
  INFY:    {vol:"7.6M", mcap:"₹7.2L Cr" },
  HDFCBANK:{vol:"9.2M", mcap:"₹12.3L Cr"},
  WIPRO:   {vol:"5.8M", mcap:"₹2.5L Cr" },
  ADANIENT:{vol:"4.4M", mcap:"₹3.2L Cr" },
};

interface StockMeta { price:number; change:number; high:number; low:number; open:number; prevClose:number; }
interface SectorData { name:string; change:number; }
interface IndexData  { label:string; value:string; change:string; up:boolean; }

/* ─── Helpers ───────────────────────────────────────────────────── */
function generateSpark(n=24,up=true):number[]{
  const pts=[50];
  for(let i=1;i<n;i++){const d=(Math.random()-(up?.4:.6))*8;pts.push(Math.max(10,Math.min(90,pts[i-1]+d)));}
  return pts;
}

function MiniSpark({pts,up,w=72,h=24}:{pts:number[];up:boolean;w?:number;h?:number}){
  const mn=Math.min(...pts),mx=Math.max(...pts);
  const norm=(v:number)=>h-((v-mn)/(mx-mn+.01))*h;
  const step=w/(pts.length-1);
  const d=pts.map((p,i)=>`${i===0?"M":"L"}${(i*step).toFixed(1)},${norm(p).toFixed(1)}`).join(" ");
  return(
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={d} stroke={up?UP:DN} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

function AreaChart({pts,up}:{pts:number[];up:boolean}){
  if(pts.length<2)return null;
  const W=600,H=130;
  const mn=Math.min(...pts)-2,mx=Math.max(...pts)+2;
  const ny=(v:number)=>H-((v-mn)/(mx-mn))*(H-8);
  const step=W/(pts.length-1);
  const line=pts.map((p,i)=>`${i===0?"M":"L"}${(i*step).toFixed(1)},${ny(p).toFixed(1)}`).join(" ");
  const area=`M0,${H} `+pts.map((p,i)=>`L${(i*step).toFixed(1)},${ny(p).toFixed(1)}`).join(" ")+` L${W},${H}Z`;
  const c=up?UP:DN;
  const lx=((pts.length-1)*step).toFixed(1),ly=ny(pts[pts.length-1]).toFixed(1);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{width:"100%",height:130}}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={c} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ag)"/>
      <path d={line} stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <circle cx={lx} cy={ly} r="4" fill={c}/>
      <circle cx={lx} cy={ly} r="8" fill={c} opacity="0.15"/>
    </svg>
  );
}

function FlashNum({v,prev}:{v:number;prev?:number}){
  const[flash,setFlash]=useState<"u"|"d"|null>(null);
  const first=useRef(true);
  useEffect(()=>{
    if(first.current){first.current=false;return;}
    if(!prev||v===prev)return;
    setFlash(v>prev?"u":"d");
    const t=setTimeout(()=>setFlash(null),700);
    return()=>clearTimeout(t);
  },[v]);
  const bg=flash==="u"?UP_BG:flash==="d"?DN_BG:"transparent";
  return(
    <span style={{background:bg,borderRadius:3,padding:"1px 3px",transition:"background .7s ease-out",fontVariantNumeric:"tabular-nums"}}>
      ₹{v.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
    </span>
  );
}

/* ─── Card shell ────────────────────────────────────────────────── */
function Card({children,style,className}:{children:React.ReactNode;style?:React.CSSProperties;className?:string}){
  return(
    <div className={className} style={{background:CARD,border:`0.5px solid ${BDR}`,borderRadius:12,padding:"16px 18px",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",...style}}>
      {children}
    </div>
  );
}

function SectionLabel({children}:{children:React.ReactNode}){
  return <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.07em",color:T3,textTransform:"uppercase",marginBottom:10}}>{children}</div>;
}

function Badge({children,color="up"}:{children:React.ReactNode;color?:"up"|"dn"|"amb"|"neu"}){
  const bg=color==="up"?UP_BG:color==="dn"?DN_BG:color==="amb"?AMB_BG:"rgba(255,255,255,0.06)";
  const cl=color==="up"?UP:color==="dn"?DN:color==="amb"?AMB:T3;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:20,background:bg,color:cl,letterSpacing:"0.04em"}}>
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function Dashboard(){
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const[ticker,    setTicker]    = useState("");
  const[stockData, setStockData] = useState<any>(null);
  const[loading,   setLoading]   = useState(false);
  const[chartPts,  setChartPts]  = useState<number[]>([]);
  const[sparks,    setSparks]    = useState<Record<string,number[]>>({});
  const[activeChip,setActiveChip]= useState("");
  const[now,       setNow]       = useState("");
  const[portfolio, setPortfolio] = useState<any[]>([]);
  const[aiInsights,setAiInsights]= useState<any[]>([]);
  const[aiLoading, setAiLoading] = useState(false);
  const[mounted,   setMounted]   = useState(false);
  const[stockMeta, setStockMeta] = useState<Record<string,StockMeta>>({});
  const[sectors,   setSectors]   = useState<SectorData[]>([]);
  const[indices,   setIndices]   = useState<IndexData[]>([]);
  const[metaLoading,setMetaLoading]=useState(true);

  const{prices,prevPrices,connected}=useLivePrices(FEATURED,!!marketStatus?.is_live);

  const fetchStockMeta=useCallback(async()=>{
    setMetaLoading(true);
    const meta:Record<string,StockMeta>={};
    await Promise.allSettled(FEATURED.map(async sym=>{
      try{
        const data=await apiFetch(`/stock/${sym}`);
        if(data.price&&!data.error) meta[sym]={price:data.price,change:data.change??0,high:data.high??data.price,low:data.low??data.price,open:data.open??data.price,prevClose:data.prev_close??data.price};
      }catch{}
    }));
    setStockMeta(meta);setMetaLoading(false);
  },[]);

  const fetchSectors=useCallback(async()=>{
    try{
      const data=await apiFetch("/market/sectors");setSectors(data);
    }catch{
      try{
        const data=await apiFetch("/market/movers");
        const allStocks=[...(data.gainers??[]),...(data.losers??[])];
        const sectorStocks:Record<string,string[]>={Banking:["HDFCBANK","ICICIBANK","SBIN","AXISBANK","KOTAKBANK"],IT:["TCS","INFY","WIPRO","HCLTECH"],Energy:["RELIANCE","ONGC","BPCL"],Pharma:["SUNPHARMA","DRREDDY","CIPLA"],Auto:["MARUTI","TATAMOTORS","HEROMOTOCO"],FMCG:["HINDUNILVR","ITC","NESTLEIND"],Metals:["TATASTEEL","JSWSTEEL","COALINDIA"],Infra:["LT","ADANIPORTS","NTPC"]};
        const priceMap:Record<string,number>={};
        allStocks.forEach((s:any)=>{priceMap[s.ticker]=s.change;});
        setSectors(Object.entries(sectorStocks).map(([name,tickers])=>{
          const changes=tickers.map(t=>priceMap[t]).filter(v=>v!=null);
          return{name,change:Math.round((changes.length>0?changes.reduce((a,b)=>a+b,0)/changes.length:0)*100)/100};
        }));
      }catch{}
    }
  },[]);

  const fetchIndices=useCallback(async()=>{
    try{
      const data:any[]=await apiFetch("/market/indices");
      const picks=[{ticker:"^NSEI",label:"Nifty"},{ticker:"^BSESN",label:"Sensex"},{ticker:"^VIX",label:"VIX"}];
      setIndices(picks.map(p=>{
        const found=data.find((d:any)=>d.ticker===p.ticker);
        if(!found)return{label:p.label,value:"—",change:"—",up:true};
        const up=found.change>=0;
        return{label:p.label,value:found.price.toLocaleString("en-IN"),change:`${up?"▲":"▼"} ${Math.abs(found.change).toFixed(2)}%`,up};
      }));
    }catch{}
  },[]);

  useEffect(()=>{
    setMounted(true);
    if(typeof window!=="undefined"&&!localStorage.getItem("token")){router.push("/login");return;}
    const map:Record<string,number[]>={};
    FEATURED.forEach(t=>{map[t]=generateSpark(24,true);});setSparks(map);
    const iv=setInterval(()=>setNow(new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})),1000);
    Promise.all([apiFetch("/portfolio/all").then(d=>{if(Array.isArray(d))setPortfolio(d);}).catch(()=>{}),fetchStockMeta(),fetchSectors(),fetchIndices()]);
    return()=>clearInterval(iv);
  },[]);

  useEffect(()=>{
    if(Object.keys(stockMeta).length===0)return;
    const map:Record<string,number[]>={};
    FEATURED.forEach(t=>{const up=(stockMeta[t]?.change??0)>=0;map[t]=generateSpark(24,up);});setSparks(map);
  },[stockMeta]);

  useEffect(()=>{
    if(!mounted)return;
    setAiLoading(true);
    apiPost("/ai/chat",{message:'Give me 4 ultra-short insights for today\'s Indian market: 1) Top Opportunity 2) Risk Alert 3) Rebalance Suggestion 4) Hidden Gem. Each max 15 words. Return as JSON array: [{type,title,insight,sentiment}] where sentiment is bullish/bearish/caution. Return ONLY valid JSON, no markdown.',history:[]})
      .then(d=>{
        try{const clean=(d.response||"").replace(/```json|```/g,"").trim();const parsed=JSON.parse(clean);if(Array.isArray(parsed))setAiInsights(parsed);}catch{}
        setAiLoading(false);
      }).catch(()=>setAiLoading(false));
  },[mounted]);

  const fetchStock=useCallback(async(sym?:string)=>{
    const symbol=(sym||ticker).trim().toUpperCase();if(!symbol)return;
    setLoading(true);setTicker(symbol);setActiveChip(symbol);
    try{
      const r=await apiFetch(`/stock/${symbol}`);
      if(r.error||!r.close_prices?.length){setStockData(null);setActiveChip("");setLoading(false);return;}
      const price=r.price||r.close_prices.at(-1),change=r.change??0,fb=FALLBACK[symbol]??{vol:"—",mcap:"—"};
      setChartPts(r.close_prices.length>=10?r.close_prices.slice(-60):generateSpark(60,change>=0).map((p:number)=>+(price*.96+p*.08).toFixed(2)));
      setStockData({price,change,high:r.high||price*1.01,low:r.low||price*.99,name:r.name||symbol,vol:fb.vol,mcap:fb.mcap,ticker:symbol});
    }catch{setStockData(null);setActiveChip("");}
    setLoading(false);
  },[ticker]);

  const totalInvested=portfolio.reduce((s,p)=>s+(p.invested??0),0);
  const totalValue   =portfolio.reduce((s,p)=>s+(p.current_value??0),0);
  const totalPnL     =totalValue-totalInvested;
  const pnlPct       =totalInvested>0?(totalPnL/totalInvested*100):0;
  const isUp         =(stockData?.change??0)>=0;
  const displayIndices=indices.length>0?indices:[{label:"Nifty",value:"—",change:"—",up:true},{label:"Sensex",value:"—",change:"—",up:true},{label:"VIX",value:"—",change:"—",up:false}];

  const insightColor=(s:string)=>s==="bullish"?UP:s==="bearish"?DN:AMB;
  const insightBg   =(s:string)=>s==="bullish"?UP_BG:s==="bearish"?DN_BG:AMB_BG;

  const navTiles=[
    {label:"Portfolio",    sub:"Live P&L",         path:"/portfolio",    color:UP   },
    {label:"Watchlist",    sub:"Price tracking",    path:"/watchlist",    color:T2   },
    {label:"Market",       sub:"Indices & movers",  path:"/market",       color:AMB  },
    {label:"Transactions", sub:"Trade history",     path:"/transactions", color:T2   },
    {label:"AI Advisor",   sub:"Gemini AI",         path:"/ai",           color:UP   },
    {label:"Screener",     sub:"NSE/BSE filter",    path:"/screener",     color:DN   },
  ];

  if(!mounted)return null;

  return(
    <>
      <ParticleCanvas/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#111111;overflow-x:clip;}

        @keyframes fade-up{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse-dot{0%,100%{opacity:1;}50%{opacity:0.3;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes shimmer{from{background-position:200% 0;}to{background-position:-200% 0;}}

        .fade-up{animation:fade-up .35s ease-out both;}
        .pulse{animation:pulse-dot 1.8s ease-in-out infinite;}
        .skel{background:linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%);background-size:400% 100%;animation:shimmer 1.5s infinite;border-radius:6px;}

        .db-input{
          background:${SURF};border:0.5px solid ${BDR};color:${T1};
          padding:10px 14px;border-radius:8px;font-size:13px;
          font-family:'DM Sans',sans-serif;outline:none;
          transition:border-color .2s;width:100%;
        }
        .db-input::placeholder{color:${T3};}
        .db-input:focus{border-color:${T2};}

        .pill-btn{
          padding:4px 12px;background:transparent;
          border:0.5px solid ${BDR};border-radius:20px;
          color:${T3};font-size:11px;font-weight:500;cursor:pointer;
          transition:all .15s;font-family:'DM Sans',sans-serif;
          letter-spacing:0.03em;
        }
        .pill-btn:hover{border-color:${T2};color:${T2};}
        .pill-btn.on{background:rgba(61,186,106,0.08);border-color:rgba(61,186,106,0.3);color:${UP};}

        .stock-chip{
          background:${CARD};border:0.5px solid ${BDR};border-radius:10px;
          padding:12px;cursor:pointer;
          transition:border-color .2s,transform .15s;
          backdrop-filter:blur(8px);
        }
        .stock-chip:hover{border-color:${T3};transform:translateY(-1px);}
        .stock-chip.active{border-color:rgba(61,186,106,0.35);background:rgba(61,186,106,0.04);}

        .nav-tile{
          background:${CARD};border:0.5px solid ${BDR};border-radius:10px;
          padding:14px 16px;cursor:pointer;
          transition:border-color .2s,transform .15s;
          display:flex;justify-content:space-between;align-items:center;
          backdrop-filter:blur(8px);
        }
        .nav-tile:hover{border-color:${T3};transform:translateY(-1px);}

        .act-btn{
          padding:7px 14px;background:transparent;
          border:0.5px solid ${BDR};border-radius:7px;
          color:${T3};font-size:12px;font-weight:500;cursor:pointer;
          font-family:'DM Sans',sans-serif;transition:all .15s;
        }
        .act-btn:hover{border-color:${T2};color:${T2};}

        .sector-chip{
          padding:10px 12px;border-radius:8px;border:0.5px solid;
          display:flex;justify-content:space-between;align-items:center;
        }

        .insight-card{
          border-radius:10px;padding:12px 14px;border:0.5px solid;
          transition:transform .15s;cursor:pointer;
        }
        .insight-card:hover{transform:translateY(-2px);}

        /* layout grid */
        .db-wrap{min-height:100vh;padding:16px;display:flex;flex-direction:column;gap:12px;font-family:'DM Sans',sans-serif;color:${T1};}
        .db-hero{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
        .db-stocks{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;}
        .db-mid{display:grid;grid-template-columns:2fr 1fr;gap:10px;align-items:start;}
        .db-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .db-sectors{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;}
        .db-portfolio-row{display:grid;gap:8px;}
        .db-search-row{display:flex;gap:8px;}

        @media(max-width:900px){
          .db-hero{grid-template-columns:1fr;}
          .db-stocks{grid-template-columns:repeat(3,minmax(0,1fr));}
          .db-mid{grid-template-columns:1fr;}
          .db-sectors{grid-template-columns:repeat(2,1fr);}
          .db-search-row{flex-direction:column;}
          .db-clock{display:none;}
        }
        @media(max-width:500px){
          .db-stocks{grid-template-columns:repeat(2,minmax(0,1fr));}
          .db-nav{grid-template-columns:1fr;}
          .db-wrap{padding:10px;gap:8px;}
        }
      `}</style>

      <div className="db-wrap" style={{position:"relative",zIndex:4}}>

        {/* ── TOP BAR ── */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            {/* Logo */}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:6,background:T1,color:BG,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <polyline points="1,12 5,7 8,9 12,4 15,6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="15" cy="6" r="1.2" fill="currentColor"/>
                </svg>
              </div>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:16,color:T1,letterSpacing:"-0.01em"}}>QuantAI</span>
            </div>

            <span style={{width:1,height:16,background:BDR}}/>
            <span style={{fontSize:11,color:T3,letterSpacing:"0.04em"}}>NSE · BSE</span>

            {/* Market status */}
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span className="pulse" style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:marketStatus?.is_live?UP:T3}}/>
              <span style={{fontSize:11,color:marketStatus?.is_live?UP:T3}}>
                {marketStatus?.is_live?"Live":"Closed"}
              </span>
            </div>
            {marketStatus?.is_live&&connected&&(
              <Badge color="up">⚡ live</Badge>
            )}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span className="db-clock" style={{fontSize:11,color:T3,fontVariantNumeric:"tabular-nums"}}>{now||"——:——:——"}</span>
            <button className="pill-btn" onClick={()=>{localStorage.removeItem("token");router.push("/login");}}>Sign out</button>
          </div>
        </div>

        {/* ── HERO ROW ── */}
        <div className="db-hero">

          {/* Portfolio value */}
          <Card>
            <SectionLabel>Portfolio value</SectionLabel>
            {portfolio.length>0?(
              <>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(1.6rem,3.5vw,2.2rem)",letterSpacing:"-0.03em",color:T1,lineHeight:1,marginBottom:8}}>
                  ₹{totalValue.toLocaleString("en-IN",{minimumFractionDigits:2})}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:16}}>
                  <Badge color={totalPnL>=0?"up":"dn"}>
                    {totalPnL>=0?"▲":"▼"} {Math.abs(pnlPct).toFixed(2)}%
                  </Badge>
                  <span style={{fontSize:12,color:totalPnL>=0?UP:DN}}>
                    {totalPnL>=0?"+":""}₹{totalPnL.toLocaleString("en-IN",{minimumFractionDigits:2})}
                  </span>
                </div>
                <div style={{height:"0.5px",background:BDR,marginBottom:14}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:10,color:T3,letterSpacing:"0.06em",marginBottom:3}}>INVESTED</div>
                    <div style={{fontSize:13,fontWeight:500,color:T2}}>₹{totalInvested.toLocaleString("en-IN",{minimumFractionDigits:0})}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:T3,letterSpacing:"0.06em",marginBottom:3}}>POSITIONS</div>
                    <div style={{fontSize:13,fontWeight:500,color:T2}}>{portfolio.length}</div>
                  </div>
                </div>
              </>
            ):(
              <>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"2rem",color:SURF,marginBottom:8}}>₹—</div>
                <p style={{fontSize:12,color:T3}}>No holdings ·{" "}
                  <span style={{color:UP,cursor:"pointer"}} onClick={()=>router.push("/transactions")}>Add transactions →</span>
                </p>
              </>
            )}
          </Card>

          {/* Market status + indices */}
          <Card>
            <SectionLabel>Market overview</SectionLabel>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <div style={{fontSize:10,color:T3,letterSpacing:"0.06em",marginBottom:4}}>SESSION</div>
                <Badge color={marketStatus?.is_live?"up":"neu"}>
                  {marketStatus?.is_live?"● Live":"◎ Closed"}
                </Badge>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:T3,letterSpacing:"0.06em",marginBottom:4}}>HOURS</div>
                <div style={{fontSize:12,color:T2}}>09:15–15:30 IST</div>
              </div>
            </div>
            <div style={{height:"0.5px",background:BDR,marginBottom:14}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {displayIndices.map(idx=>(
                <div key={idx.label}>
                  <div style={{fontSize:10,color:T3,letterSpacing:"0.06em",marginBottom:4}}>{idx.label.toUpperCase()}</div>
                  {idx.value==="—"
                    ?<div className="skel" style={{height:14,width:52}}/>
                    :<div style={{fontSize:11,fontWeight:500,color:idx.up?UP:DN}}>{idx.change}</div>
                  }
                  {idx.value!=="—"&&<div style={{fontSize:11,color:T2,marginTop:1}}>{idx.value}</div>}
                </div>
              ))}
            </div>
          </Card>

          {/* Sector pulse */}
          <Card>
            <SectionLabel>Sector pulse</SectionLabel>
            {sectors.length===0?(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                {[...Array(4)].map((_,i)=><div key={i} className="skel" style={{height:34}}/>)}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                {sectors.slice(0,6).map(s=>{
                  const up=s.change>=0;
                  return(
                    <div key={s.name} className="sector-chip"
                      style={{background:up?UP_BG:DN_BG,borderColor:up?"rgba(61,186,106,0.2)":"rgba(224,85,85,0.2)"}}>
                      <span style={{fontSize:10,color:T3}}>{s.name}</span>
                      <span style={{fontSize:10,fontWeight:500,color:up?UP:DN}}>{up?"+":""}{s.change}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── FEATURED STOCKS ── */}
        <div className="db-stocks">
          {FEATURED.map(sym=>{
            const meta=stockMeta[sym];
            const live=prices[sym]??meta?.price??0;
            const prev=prevPrices[sym];
            const chg=meta?.change??0;
            const up=chg>=0;
            return(
              <div key={sym} className={`stock-chip${activeChip===sym?" active":""}`} onClick={()=>fetchStock(sym)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:10,fontWeight:500,color:T2,letterSpacing:"0.04em"}}>{sym}</span>
                  {metaLoading
                    ?<div className="skel" style={{width:28,height:10}}/>
                    :<span style={{fontSize:10,fontWeight:500,color:up?UP:DN}}>{up?"+":""}{chg.toFixed(1)}%</span>
                  }
                </div>
                <div style={{fontSize:12,fontWeight:500,color:T1,marginBottom:6,minHeight:18}}>
                  {live>0?<FlashNum v={live} prev={prev}/>:<div className="skel" style={{width:60,height:12}}/>}
                </div>
                {sparks[sym]&&<MiniSpark pts={sparks[sym]} up={up}/>}
              </div>
            );
          })}
        </div>

        {/* ── MID ROW ── */}
        <div className="db-mid">

          {/* Left: search + chart / nav */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            {/* Search */}
            <Card style={{padding:"12px 14px"}}>
              <div className="db-search-row" style={{marginBottom:10}}>
                <input
                  className="db-input"
                  value={ticker}
                  onChange={e=>setTicker(e.target.value.toUpperCase())}
                  onKeyDown={e=>e.key==="Enter"&&fetchStock()}
                  placeholder="Search NSE/BSE · RELIANCE, TCS, INFY…"
                />
                <button
                  onClick={()=>fetchStock()}
                  style={{flexShrink:0,height:42,padding:"0 20px",background:UP_BG,color:UP,border:"0.5px solid rgba(61,186,106,0.3)",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap"}}
                >
                  {loading && (
  <>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
      {[1,2,3,4].map(i => <SkeletonStatCard key={i} />)}
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
      <SkeletonChartCard height={200} />
      <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
        {[1,2,3,4,5].map(i => <SkeletonMoverRow key={i} />)}
      </div>
    </div>
  </>
)}
                </button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {FEATURED.map(t=>(
                  <button key={t} className={`pill-btn${activeChip===t?" on":""}`} onClick={()=>fetchStock(t)}>{t}</button>
                ))}
              </div>
            </Card>

            {/* Chart or nav tiles */}
            {stockData?(
              <Card className="fade-up">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                      <span style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:T1}}>{stockData.ticker}</span>
                      <Badge color={isUp?"up":"dn"}>{isUp?"+":""}{stockData.change.toFixed(2)}%</Badge>
                    </div>
                    <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(1.3rem,3.5vw,1.8rem)",color:T1,letterSpacing:"-0.02em"}}>
                      ₹{stockData.price.toLocaleString("en-IN",{minimumFractionDigits:2})}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                    {[["HIGH",`₹${stockData.high.toFixed(2)}`,UP],["LOW",`₹${stockData.low.toFixed(2)}`,DN],["VOL",stockData.vol,T3]].map(([l,v,c])=>(
                      <div key={l as string}>
                        <div style={{fontSize:9,color:T3,letterSpacing:"0.06em",marginBottom:3}}>{l}</div>
                        <div style={{fontSize:12,fontWeight:500,color:c as string}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <AreaChart pts={chartPts} up={isUp}/>
                <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
                  <button className="act-btn" onClick={()=>router.push("/analysis")}>Deep Analysis</button>
                  <button className="act-btn" style={{color:UP,borderColor:"rgba(61,186,106,0.2)"}} onClick={()=>router.push("/news")}>News</button>
                  <button className="act-btn" style={{color:T2,borderColor:BDR}} onClick={()=>router.push("/ai")}>AI Chat</button>
                  <button className="act-btn" style={{color:AMB,borderColor:"rgba(196,148,58,0.2)"}} onClick={()=>router.push("/charts")}>Charts</button>
                </div>
              </Card>
            ):(
              <div className="db-nav">
                {navTiles.map(f=>(
                  <div key={f.label} className="nav-tile" onClick={()=>router.push(f.path)}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:T1,marginBottom:3}}>{f.label}</div>
                      <div style={{fontSize:11,color:T3}}>{f.sub}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" opacity={0.6}>
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: AI Insights */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <SectionLabel>AI Insights</SectionLabel>
              <Badge color="neu">Gemini</Badge>
            </div>
            {aiLoading?(
              [...Array(4)].map((_,i)=>(
                <div key={i} className="skel" style={{height:80,borderRadius:10,animationDelay:`${i*.1}s`}}/>
              ))
            ):aiInsights.length>0?(
              aiInsights.map((ins,i)=>{
                const c=insightColor(ins.sentiment);
                const bg=insightBg(ins.sentiment);
                const bdr=c===UP?"rgba(61,186,106,0.2)":c===DN?"rgba(224,85,85,0.2)":"rgba(196,148,58,0.2)";
                return(
                  <div key={i} className="insight-card fade-up"
                    style={{background:bg,borderColor:bdr,animationDelay:`${i*.08}s`}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                      <span style={{fontSize:10,fontWeight:600,color:c,letterSpacing:"0.05em",textTransform:"uppercase"}}>{ins.type}</span>
                    </div>
                    <div style={{fontSize:13,fontWeight:500,color:T1,marginBottom:3}}>{ins.title}</div>
                    <div style={{fontSize:12,color:T2,lineHeight:1.5}}>{ins.insight}</div>
                  </div>
                );
              })
            ):(
              <Card style={{textAlign:"center",padding:"24px 16px"}}>
                <div style={{fontSize:12,color:T3,marginBottom:10}}>AI insights loading…</div>
                <button className="pill-btn" onClick={()=>router.push("/ai")}>Open AI Chat →</button>
              </Card>
            )}
          </div>
        </div>

        {/* ── SECTOR HEATMAP ── */}
        <Card style={{padding:"14px 16px"}}>
          <SectionLabel>Sector heatmap</SectionLabel>
          {sectors.length===0?(
            <div className="db-sectors">
              {[...Array(8)].map((_,i)=><div key={i} className="skel" style={{height:40}}/>)}
            </div>
          ):(
            <div className="db-sectors">
              {sectors.map(s=>{
                const up=s.change>=0;
                return(
                  <div key={s.name} className="sector-chip"
                    style={{height:48,background:up?UP_BG:DN_BG,borderColor:up?"rgba(61,186,106,0.18)":"rgba(224,85,85,0.18)"}}>
                    <span style={{fontSize:11,color:T3}}>{s.name}</span>
                    <span style={{fontSize:11,fontWeight:500,color:up?UP:DN}}>{up?"+":""}{s.change}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── PORTFOLIO STRIP ── */}
        {portfolio.length>0&&(
          <Card style={{padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <SectionLabel>Holdings</SectionLabel>
              <button className="pill-btn" onClick={()=>router.push("/portfolio")}>View all →</button>
            </div>
            <div className="db-portfolio-row" style={{gridTemplateColumns:`repeat(${Math.min(portfolio.length,5)},minmax(0,1fr))`}}>
              {portfolio.slice(0,5).map((p:any)=>{
                const pnl=p.profit_loss??0,pct=p.percent_change??0;
                return(
                  <div key={p.ticker} style={{padding:"10px 12px",background:SURF,borderRadius:8,border:`0.5px solid ${BDR}`}}>
                    <div style={{fontSize:11,fontWeight:500,color:UP,marginBottom:3}}>{p.ticker}</div>
                    <div style={{fontSize:13,fontWeight:500,color:T1,marginBottom:6}}>
                      ₹{(p.current_price_inr??0).toLocaleString("en-IN",{minimumFractionDigits:2})}
                    </div>
                    <Badge color={pnl>=0?"up":"dn"}>{pnl>=0?"+":""}{pct.toFixed(1)}%</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── FOOTER ── */}
        <div style={{textAlign:"center",fontSize:10,color:T3,paddingBottom:4,letterSpacing:"0.04em"}}>
          {marketStatus?.is_live
            ?connected?"⚡ live · Angel One WebSocket · NSE/BSE":"reconnecting…"
            :`closed · opens ${marketStatus?.market_open??"09:15"} IST weekdays`
          }
        </div>

      </div>
    </>
  );
}