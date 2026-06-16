"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import ParticleCanvas from "@/components/ParticleCanvas";

/* ─── Dark theme constants ──────────────────────────────────────── */
const BG      = "#111111";
const CARD    = "#1a1a1a";
const SURF    = "#222222";
const BDR     = "#2c2c2c";
const BDRS    = "#252525";
const T1      = "#f0f0ee";
const T2      = "#888884";
const T3      = "#555552";
const UP      = "#3dba6a";
const DN      = "#e05555";
const UP_BG   = "rgba(61,186,106,0.10)";
const DN_BG   = "rgba(224,85,85,0.10)";
const SPARK   = "M0,38 C8,35 14,30 22,26 C30,22 36,28 44,22 C52,16 58,10 66,12 C74,14 80,8 88,5 C96,2 100,4 108,2";

/* ─── Data ──────────────────────────────────────────────────────── */
const TICKERS = [
  { sym:"NIFTY 50",   val:"22,847.30", chg:"+1.15%", up:true  },
  { sym:"SENSEX",     val:"75,320.10", chg:"+0.98%", up:true  },
  { sym:"BANK NIFTY", val:"48,102.55", chg:"-0.31%", up:false },
  { sym:"RELIANCE",   val:"₹2,840.00", chg:"+2.10%", up:true  },
  { sym:"TCS",        val:"₹3,201.40", chg:"+1.40%", up:true  },
  { sym:"INFY",       val:"₹1,572.80", chg:"-0.80%", up:false },
  { sym:"HDFC BANK",  val:"₹1,648.20", chg:"+0.55%", up:true  },
  { sym:"WIPRO",      val:"₹482.65",   chg:"-0.43%", up:false },
  { sym:"GOLD",       val:"₹72,840",   chg:"+0.44%", up:true  },
];

const FEATURES = [
  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>, title:"AI Investment Advisor", desc:"Personalized insights powered by Google Gemini. Ask anything about stocks, portfolios, and market trends." },
  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title:"Technical Analysis", desc:"Advanced algorithms — SMA, EMA, Sharpe Ratio, Segment Tree queries and volatility calculations built in." },
  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>, title:"Portfolio Tracker", desc:"Track investments with live P&L. Real-time prices with automatic USD to INR conversion." },
  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M2 8h6M2 12h6M2 16h6"/></svg>, title:"AI News Analysis", desc:"AI-summarised financial news for any stock. Understand market sentiment at a glance, instantly." },
  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>, title:"Portfolio Optimiser", desc:"Knapsack algorithm-based optimisation. Maximise returns based on your exact risk tolerance." },
  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>, title:"Stock Screener", desc:"Filter and discover stocks by technical and fundamental criteria across global markets." },
];

const SIGNALS = [
  { sym:"HDFC",  action:"BUY",  conf:91, reason:"Bullish breakout above resistance", up:true  },
  { sym:"WIPRO", action:"SELL", conf:78, reason:"RSI overbought, weak momentum",     up:false },
  { sym:"LTIM",  action:"BUY",  conf:86, reason:"Golden cross on 50/200 DMA",        up:true  },
];

const STATS = [
  { value:"48,200+", label:"Active users"      },
  { value:"2.1M",    label:"Signals generated" },
  { value:"81.4%",   label:"Avg. accuracy"     },
  { value:"12",      label:"Brokers connected" },
];

const STEPS = [
  { n:"01", title:"Create account",     desc:"Sign up free and set up your investor profile in seconds." },
  { n:"02", title:"Add your portfolio", desc:"Add stock holdings and let us track live P&L automatically." },
  { n:"03", title:"Get AI signals",     desc:"Ask our AI advisor anything and get personalised recommendations." },
];

const PLANS = [
  { name:"Free",       price:"₹0",    period:"forever",   highlight:false, cta:"Get started free", features:["5 AI queries per day","Basic portfolio tracking","Stock charts","News analysis"] },
  { name:"Pro",        price:"₹499",  period:"per month", highlight:true,  cta:"Start Pro",        features:["Unlimited AI queries","Advanced technical analysis","Portfolio optimiser","Real-time alerts","Priority support"] },
  { name:"Enterprise", price:"Custom",period:"contact us", highlight:false, cta:"Contact us",       features:["Everything in Pro","Custom AI models","API access","Dedicated support","Team accounts"] },
];

const ACCENT_COLORS = [UP, DN, "#c4943a"];

/* ─── Shared CSS ────────────────────────────────────────────────── */
const GLOBAL_CSS = `

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{overflow-x:clip;max-width:100%;background:#111111;}

@keyframes ticker-scroll{0%{transform:translateX(0);}100%{transform:translateX(-50%);}}
@keyframes fade-up{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse-dot{0%,100%{opacity:1;}50%{opacity:0.3;}}
@keyframes card-drift{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}

.fu1{animation:fade-up 0.6s ease both 0.05s;}
.fu2{animation:fade-up 0.6s ease both 0.15s;}
.fu3{animation:fade-up 0.6s ease both 0.25s;}
.fu4{animation:fade-up 0.6s ease both 0.38s;}
.fu5{animation:fade-up 0.6s ease both 0.50s;}

.ticker-track{display:flex;animation:ticker-scroll 36s linear infinite;width:max-content;}

.sig-float{animation:card-drift 4s ease-in-out infinite;}
.sig-float:nth-child(2){animation-delay:0.8s;}
.sig-float:nth-child(3){animation-delay:1.6s;}

.pulse{display:inline-block;width:7px;height:7px;border-radius:50%;animation:pulse-dot 1.8s ease-in-out infinite;}

.btn-p{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;border:none;transition:opacity .15s,transform .15s;letter-spacing:.01em;}
.btn-p:hover{opacity:.85;transform:translateY(-1px);}
.btn-p:active{transform:scale(.98);}

.btn-g{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:400;font-family:inherit;cursor:pointer;transition:opacity .15s,transform .15s;background:transparent;letter-spacing:.01em;}
.btn-g:hover{opacity:.75;transform:translateY(-1px);}

.nav-a{font-size:13px;font-weight:400;cursor:pointer;text-decoration:none;color:#888884;transition:opacity .15s;}
.nav-a:hover{opacity:.55;}

.step-card{transition:transform .3s ease;}
.step-card:hover{transform:translateY(-4px);}

.feat-card-hover{transition:opacity .55s ease,transform .55s ease,border-color .2s;}

@media (max-width:1024px){
  .hero-section{grid-template-columns:1fr !important;gap:40px !important;}
  .features-grid{grid-template-columns:repeat(2,1fr) !important;}
  .steps-grid{grid-template-columns:1fr !important;}
  .footer-wrap{flex-direction:column !important;gap:14px !important;}
}
@media (max-width:768px){
  .page-padding{padding-left:20px !important;padding-right:20px !important;}
  .hero-section{grid-template-columns:1fr !important;gap:28px !important;}
  .features-grid,.steps-grid{grid-template-columns:1fr !important;}
  .hero-panel{max-width:100% !important;}
  .ticker-label{width:80px !important;}
  .ticker-content{margin-left:80px !important;}
  .ticker-fade{left:80px !important;}
  .cta-box{padding:36px 20px !important;}
  .mobile-hide{display:none !important;}
  .nav-buttons{gap:10px !important;}
  .footer-wrap{text-align:center;}
}

`;

/* ─── Features Section ──────────────────────────────────────────── */
function FeaturesSection({router}:{router:ReturnType<typeof useRouter>}) {
  const ref=useRef<HTMLElement>(null);
  const[visible,setVisible]=useState<boolean[]>(Array(6).fill(false));
  const[hovered,setHovered]=useState<number|null>(null);

  useEffect(()=>{
    const cards=ref.current?.querySelectorAll(".feat-card");
    if(!cards)return;
    const obs:IntersectionObserver[]=[];
    cards.forEach((card,i)=>{
      const o=new IntersectionObserver(([e])=>{
        if(e.isIntersecting){setTimeout(()=>setVisible(p=>{const n=[...p];n[i]=true;return n;}),i*90);o.disconnect();}
      },{threshold:.12});
      o.observe(card);obs.push(o);
    });
    return()=>obs.forEach(o=>o.disconnect());
  },[]);

  return(
    <section ref={ref} id="features" style={{position:"relative",zIndex:1,borderTop:`0.5px solid ${BDR}`,borderBottom:`0.5px solid ${BDR}`,padding:"88px 40px",background:"rgba(17,17,17,0.70)"}}>
      <div style={{maxWidth:1400,margin:"0 auto",position:"relative",zIndex:5}}>
        <div style={{marginBottom:52,maxWidth:480}}>
          <div style={{fontSize:11,color:T3,fontWeight:500,letterSpacing:"0.07em",marginBottom:12}}>FEATURES</div>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(28px,3.5vw,40px)",color:T1,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:14}}>
            Everything you need<br/><span style={{fontStyle:"italic",color:T2}}>to invest smarter.</span>
          </h2>
          <p style={{fontSize:15,color:T2,lineHeight:1.65,fontWeight:300}}>Professional-grade tools powered by AI and advanced algorithms — built for the Indian market.</p>
        </div>
        <div className="features-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {FEATURES.map((f,i)=>(
            <div key={i} className="feat-card feat-card-hover"
              onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}
              style={{position:"relative",borderRadius:12,padding:24,background:"rgba(26,26,26,0.50)",border:`0.5px solid ${hovered===i?T3:BDR}`,overflow:"hidden",cursor:"default",opacity:visible[i]?1:0,transform:visible[i]?"translateY(0)":"translateY(28px)"}}>
              <div style={{position:"absolute",inset:0,borderRadius:12,background:hovered===i?`radial-gradient(circle at 25% 25%,${ACCENT_COLORS[i%3]}18 0%,transparent 65%)`:"transparent",transition:"background .4s",pointerEvents:"none"}}/>
              <div style={{position:"absolute",top:0,left:hovered===i?"0%":"50%",width:hovered===i?"100%":"0%",height:1.5,background:ACCENT_COLORS[i%3],transition:"width .35s ease,left .35s ease"}}/>
              <div style={{position:"absolute",top:18,right:18,fontSize:11,fontWeight:500,color:hovered===i?T2:T3,fontFamily:"'DM Serif Display',serif",transition:"color .2s"}}>0{i+1}</div>
              <div style={{width:38,height:38,borderRadius:9,background:SURF,border:`0.5px solid ${BDR}`,display:"flex",alignItems:"center",justifyContent:"center",color:T2,marginBottom:18,transform:hovered===i?"scale(1.08)":"scale(1)",transition:"transform .25s"}}>{f.icon}</div>
              <div style={{fontSize:14,fontWeight:500,color:T1,marginBottom:8}}>{f.title}</div>
              <div style={{fontSize:13,color:T2,lineHeight:1.65,fontWeight:300}}>{f.desc}</div>
              <div style={{marginTop:16,display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:500,color:ACCENT_COLORS[i%3],opacity:hovered===i?1:0,transform:hovered===i?"translateX(0)":"translateX(-8px)",transition:"opacity .25s,transform .25s"}}>
                Learn more
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const router=useRouter();
  const[count,setCount]=useState(0);

  useEffect(()=>{
    let raf:number,start:number|null=null;
    const target=48200,dur=1800;
    const step=(ts:number)=>{if(!start)start=ts;const p=Math.min((ts-start)/dur,1);setCount(Math.floor((1-Math.pow(1-p,3))*target));if(p<1)raf=requestAnimationFrame(step);};
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[]);

  return(
    <>
    <ParticleCanvas/>
    <div style={{minHeight:"100vh",background:BG,color:T1,fontFamily:"'DM Sans','Helvetica Neue',sans-serif",overflowX:"clip",width:"100%"}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{position:"relative",zIndex:1}}>

        {/* NAV */}
<nav
  style={{
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "rgba(26,26,26,0.65)",
    borderBottom: `0.5px solid ${BDR}`,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  }}
>
  <div
    style={{
      width: "100%",
      padding: "0 32px",
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    {/* Logo */}
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: T1,
          color: BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <polyline
            points="1,12 5,7 8,9 12,4 15,6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="15" cy="6" r="1.2" fill="currentColor" />
        </svg>
      </div>

      <span
        style={{
          fontFamily: "'DM Serif Display',serif",
          fontSize: 17,
          color: T1,
          letterSpacing: "-0.01em",
        }}
      >
        QuantAI
      </span>
    </div>

    {/* Right Side */}
    <div className="nav-buttons" style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <a href="#features" className="nav-a mobile-hide">
        Features
      </a>

      <a href="#how-it-works" className="nav-a mobile-hide">
        How it works
      </a>

      <button
        onClick={() => router.push("/login")}
        className="btn-g"
        style={{
          border: `0.5px solid ${BDR}`,
          color: T2,
          padding: "7px 16px",
          fontSize: 13,
        }}
      >
        Log in
      </button>

      <button
        onClick={() => router.push("/signup")}
        className="btn-p"
        style={{
          background: T1,
          color: BG,
          padding: "8px 18px",
          fontSize: 13,
        }}
      >
        Get started
      </button>
    </div>
  </div>
</nav>

      {/* TICKER */}
<div
  style={{
    background: "rgba(26,26,26,0.72)",
    borderBottom: `0.5px solid ${BDR}`,
    overflow: "hidden",
    height: 36,
    position: "relative",
    width: "100%",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  }}
>
  {/* Fixed label */}
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 120,
      zIndex: 10,
      background: "rgba(26,26,26,0.96)",
      borderRight: `0.5px solid ${BDRS}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >

    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.07em",
        color: T3,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      Illustrative data
    </span>
  </div>
<div
  style={{
    position: "absolute",
    left: 120,
    top: 0,
    bottom: 0,
    width: 40,
    zIndex: 9,
    pointerEvents: "none",
    background:
      "linear-gradient(to right, rgba(26,26,26,1), rgba(26,26,26,0))",
  }}
/>
  {/* Scroll area */}
  <div
    style={{
      marginLeft: 120,
      height: "100%",
      display: "flex",
      alignItems: "center",
      overflow: "hidden",
    }}
  >
    <div className="ticker-track">
      {[...TICKERS, ...TICKERS].map((tk, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 28px",
            whiteSpace: "nowrap",
            borderRight: `0.5px solid ${BDRS}`,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: T3,
              letterSpacing: "0.07em",
            }}
          >
            {tk.sym}
          </span>

          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: T1,
            }}
          >
            {tk.val}
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: tk.up ? UP : DN,
            }}
          >
            {tk.chg}
          </span>
        </div>
      ))}
    </div>
  </div>
</div>

        {/* HERO */}
        <section className="hero-section page-padding" style={{maxWidth:1400,margin:"0 auto",padding:"88px 40px 100px",display:"grid",gridTemplateColumns:"1fr 420px",gap:60,alignItems:"center"}}>
          <div>
            <div className="fu1" style={{marginBottom:22}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12,fontWeight:500,color:T2,background:SURF,border:`0.5px solid ${BDR}`,padding:"5px 13px",borderRadius:20,letterSpacing:"0.03em"}}>
                <span className="pulse" style={{background:UP}}/>
                AI-powered trading intelligence · India
              </span>
            </div>
            <h1 className="fu2" style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(38px,4.8vw,58px)",lineHeight:1.07,color:T1,letterSpacing:"-0.02em",marginBottom:20}}>
              Trade smarter<br/>
              <span style={{fontStyle:"italic",color:T2}}>with signals</span><br/>
              that actually work.
            </h1>
            <p className="fu3" style={{fontSize:16,lineHeight:1.7,color:T2,maxWidth:440,marginBottom:36,fontWeight:300}}>
              QuantAI connects to your broker, reads the market in real time, and surfaces AI-generated buy/sell signals — so you spend less time analysing and more time acting.
            </p>
            <div className="fu4" style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:52}}>
              <button onClick={()=>router.push("/signup")} className="btn-p" style={{background:T1,color:BG,fontSize:15,padding:"14px 32px"}}>
                Start for free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              
            </div>
           
          </div>

          {/* Right panel */}
          <div className="hero-panel" style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:420,justifySelf:"center"}}>
            <div style={{background:"rgba(26,26,26,0.50)",border:`0.5px solid ${BDR}`,borderRadius:14,padding:"18px 20px",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={{fontSize:10,color:T3,marginBottom:4,letterSpacing:"0.06em"}}>PORTFOLIO VALUE</div>
                  <div style={{fontFamily:"'DM Serif Display',serif",fontSize:30,color:T1,letterSpacing:"-0.02em",lineHeight:1}}>₹4,82,310</div>
                </div>
                <span style={{background:UP_BG,color:UP,fontSize:11,fontWeight:500,padding:"5px 10px",borderRadius:6}}>+1.78% today</span>
              </div>
              <svg viewBox="0 0 108 44" style={{width:"100%",height:46}} preserveAspectRatio="none">
                <defs><linearGradient id="spfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UP} stopOpacity="0.18"/><stop offset="100%" stopColor={UP} stopOpacity="0"/></linearGradient></defs>
                <path d={SPARK} fill="none" stroke={UP} strokeWidth="1.4" strokeLinecap="round"/>
                <path d={`${SPARK} L108,44 L0,44 Z`} fill="url(#spfill)"/>
                <circle cx="108" cy="2" r="2.5" fill={UP}/>
              </svg>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",paddingTop:12,marginTop:10,borderTop:`0.5px solid ${BDRS}`,gap:8}}>
                {[{label:"Day P&L",val:"+₹8,420",color:UP},{label:"Positions",val:"12 open",color:T1},{label:"Signals",val:"7 new",color:UP}].map(m=>(
                  <div key={m.label}><div style={{fontSize:10,color:T3,marginBottom:2}}>{m.label}</div><div style={{fontSize:13,fontWeight:500,color:m.color}}>{m.val}</div></div>
                ))}
              </div>
            </div>
            <div style={{fontSize:10,color:T3,fontWeight:500,letterSpacing:"0.07em",marginLeft:2,marginTop:2}}>AI SIGNALS</div>
            {SIGNALS.map((s,i)=>(
              <div key={i} className="sig-float" style={{background:"rgba(26,26,26,0.45)",border:`0.5px solid ${BDR}`,borderRadius:10,padding:"13px 16px",display:"flex",flexDirection:"column",gap:8,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:s.up?UP:DN,display:"inline-block",flexShrink:0}}/>
                    <span style={{fontSize:13,fontWeight:500,color:T1}}>{s.sym}</span>
                    <span style={{fontSize:11,color:T3}}>{s.reason}</span>
                  </div>
                  <span style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:5,letterSpacing:"0.04em",background:s.up?UP_BG:DN_BG,color:s.up?UP:DN,flexShrink:0}}>{s.action}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{flex:1,height:2,borderRadius:1,background:SURF,overflow:"hidden"}}>
                    <div style={{width:`${s.conf}%`,height:"100%",borderRadius:1,background:s.up?UP:DN}}/>
                  </div>
                  <span style={{fontSize:10,color:T3,minWidth:28,textAlign:"right"}}>{s.conf}%</span>
                </div>
              </div>
            ))}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"6px 0",fontSize:11,color:T3}}>
              <span className="pulse" style={{background:UP}}/> Live data · Updated 2 min ago
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <FeaturesSection router={router}/>

        {/* HOW IT WORKS */}
        <section id="how-it-works" style={{padding:"88px 40px",position:"relative",background:"rgba(17,17,17,0.70)"}}>
          <div style={{maxWidth:1400,margin:"0 auto",position:"relative",zIndex:5}}>
            <div style={{marginBottom:52,maxWidth:380}}>
              <div style={{fontSize:11,color:T3,fontWeight:500,letterSpacing:"0.07em",marginBottom:12}}>HOW IT WORKS</div>
              <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(28px,3.5vw,40px)",color:T1,letterSpacing:"-0.02em",lineHeight:1.1}}>
                Up and running<br/><span style={{fontStyle:"italic",color:T2}}>in minutes.</span>
              </h2>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,borderRadius:12,overflow:"hidden",border:`0.5px solid ${BDR}`}}>
              {STEPS.map((s,i)=>(
                <div key={i} className="step-card" style={{background:"rgba(26,26,26,0.50)",padding:"32px 28px",borderRight:i<2?`0.5px solid ${BDR}`:"none"}}>
                  <div style={{fontFamily:"'DM Serif Display',serif",fontSize:36,color:BDR,letterSpacing:"-0.03em",marginBottom:20,lineHeight:1}}>{s.n}</div>
                  <div style={{fontSize:15,fontWeight:500,color:T1,marginBottom:10}}>{s.title}</div>
                  <div style={{fontSize:13,color:T2,lineHeight:1.65,fontWeight:300}}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING
        <section id="pricing" style={{borderTop:`0.5px solid ${BDR}`,borderBottom:`0.5px solid ${BDR}`,padding:"88px 40px",position:"relative",background:"rgba(26,26,26,0.70)"}}>
          <div style={{maxWidth:1400,margin:"0 auto",position:"relative",zIndex:5}}>
            <div style={{marginBottom:52,maxWidth:380}}>
              <div style={{fontSize:11,color:T3,fontWeight:500,letterSpacing:"0.07em",marginBottom:12}}>PRICING</div>
              <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(28px,3.5vw,40px)",color:T1,letterSpacing:"-0.02em",lineHeight:1.1}}>
                Simple pricing.<br/><span style={{fontStyle:"italic",color:T2}}>No surprises.</span>
              </h2>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {PLANS.map((plan,i)=>(
                <div key={i} style={{borderRadius:12,padding:28,border:`0.5px solid ${plan.highlight?T1:BDR}`,background:plan.highlight?T1:"rgba(26,26,26,0.50)",display:"flex",flexDirection:"column"}}>
                  <div style={{fontSize:12,fontWeight:500,color:plan.highlight?BG:T3,letterSpacing:"0.04em",marginBottom:16}}>{plan.name.toUpperCase()}</div>
                  <div style={{fontFamily:"'DM Serif Display',serif",fontSize:38,color:plan.highlight?BG:T1,letterSpacing:"-0.03em",lineHeight:1}}>{plan.price}</div>
                  <div style={{fontSize:12,color:plan.highlight?BG:T3,marginTop:4,marginBottom:28}}>{plan.period}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
                    {plan.features.map((f,j)=>(
                      <div key={j} style={{display:"flex",alignItems:"flex-start",gap:9}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.highlight?BG:UP} strokeWidth="2" strokeLinecap="round" style={{flexShrink:0,marginTop:1}}><polyline points="20 6 9 17 4 12"/></svg>
                        <span style={{fontSize:13,color:plan.highlight?BG:T2,lineHeight:1.5}}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>router.push("/signup")} className="btn-p" style={{marginTop:32,width:"100%",justifyContent:"center",background:plan.highlight?BG:T1,color:plan.highlight?T1:BG,fontSize:14}}>{plan.cta}</button>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* CTA */}
        <section style={{padding:"100px 40px",position:"relative",background:"rgba(17,17,17,0.70)"}}>
          <div style={{maxWidth:720,margin:"0 auto",position:"relative",zIndex:5,background:"rgba(26,26,26,0.80)",border:`0.5px solid ${BDR}`,borderRadius:16,padding:"64px 48px",textAlign:"center",}}>
            <div style={{fontSize:11,color:T3,fontWeight:500,letterSpacing:"0.07em",marginBottom:16}}>GET STARTED</div>
            <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(28px,3.5vw,44px)",color:T1,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:16}}>
              Ready to invest<br/><span style={{fontStyle:"italic",color:T2}}>with an edge?</span>
            </h2>
            <p style={{fontSize:15,color:T2,lineHeight:1.65,fontWeight:300,maxWidth:420,margin:"0 auto 36px"}}>
              Join thousands of investors using AI to make better decisions. Start free, upgrade when you need more.
            </p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={()=>router.push("/signup")} className="btn-p" style={{background:T1,color:BG,fontSize:15,padding:"14px 36px"}}>
                Start for free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              <button onClick={()=>router.push("/login")} className="btn-g" style={{border:`0.5px solid ${BDR}`,color:T1,fontSize:15}}>Log in to dashboard</button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{background:"rgba(26,26,26,0.80)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",borderTop:`0.5px solid ${BDR}`,padding:"28px 40px"}}>
          <div style={{maxWidth:1400,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:24,height:24,borderRadius:5,background:T1,color:BG,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><polyline points="1,12 5,7 8,9 12,4 15,6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:14,color:T1}}>QuantAI</span>
            </div>
            <span style={{fontSize:12,color:T3}}>© 2025 QuantAI. Built for serious investors.</span>
            <span style={{fontSize:11,color:T3}}>AI-powered · Dark</span>
          </div>
        </footer>

      </div>
    </div>
    </>
  );
}