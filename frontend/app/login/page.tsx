"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ParticleCanvas from "@/components/ParticleCanvas";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BG   = "#111111";
const CARD = "#1a1a1a";
const SURF = "#222222";
const BDR  = "#2c2c2c";
const T1   = "#f0f0ee";
const T2   = "#888884";
const T3   = "#555552";
const UP   = "#3dba6a";
const DN   = "#e05555";

const FEATURES = [
  "AI Investment Advisor powered by Gemini",
  "Live portfolio P&L tracking",
  "Technical analysis with 6+ algorithms",
  "AI-powered financial news analysis",
];

/* ── Fixed candle data — defined outside component, deterministic ── */
const MINI_CANDLES = [
  { x: 40,  h: 14, up: true  },
  { x: 80,  h: 18, up: false },
  { x: 120, h: 11, up: true  },
  { x: 160, h: 16, up: true  },
  { x: 200, h: 9,  up: false },
  { x: 240, h: 15, up: true  },
];

export default function Login() {
  const router = useRouter();
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [showPass,    setShowPass]    = useState(false);

  useEffect(() => {
    const msg = sessionStorage.getItem("auth_message");
    if (msg) { setAuthMessage(msg); sessionStorage.removeItem("auth_message"); }
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Login failed"); setLoading(false); return; }
      localStorage.setItem("token", data.token);
      localStorage.setItem("email", data.email);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: T1, fontFamily: "'DM Sans','Helvetica Neue',sans-serif", position: "relative", overflowX: "clip" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: clip; max-width: 100%; background: #111111; }

        @keyframes fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .lfu1 { animation: fade-up 0.5s ease both 0.05s; }
        .lfu2 { animation: fade-up 0.5s ease both 0.12s; }
        .lfu3 { animation: fade-up 0.5s ease both 0.20s; }
        .lfu4 { animation: fade-up 0.5s ease both 0.28s; }
        .lfu5 { animation: fade-up 0.5s ease both 0.36s; }

        .pulse { display:inline-block; width:7px; height:7px; border-radius:50%; animation:pulse-dot 1.8s ease-in-out infinite; }

        .login-input {
          width: 100%;
          background: ${SURF};
          border: 0.5px solid ${BDR};
          color: ${T1};
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .login-input::placeholder { color: ${T3}; }
        .login-input:focus { border-color: ${T2}; background: #2a2a2a; }

        .login-btn {
          width: 100%;
          background: ${T1};
          color: ${BG};
          border: none;
          padding: 13px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
          letter-spacing: 0.01em;
        }
        .login-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .login-btn:active:not(:disabled) { transform: scale(0.99); }
        .login-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .check-row {
          display: flex; align-items: center; gap: 10px; padding: 6px 0;
        }
        .check-icon {
          width: 18px; height: 18px; border-radius: 50%;
          background: rgba(61,186,106,0.12);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* Hide browser native password reveal button */
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear,
        input::-webkit-credentials-auto-fill-button,
        input[type="password"]::-webkit-textfield-decoration-container { display: none !important; }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>

      <ParticleCanvas />

      {/* Full layout */}
      <div style={{ display: "flex", width: "100%", minHeight: "100vh", position: "relative", zIndex: 2 }}>

        {/* ── LEFT — Branding panel ── */}
        <div
          className="hide-mobile"
          style={{
            flex: "0 0 50%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "40px 48px",
            background: "rgba(26,26,26,0.60)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderRight: `0.5px solid ${BDR}`,
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: T1, color: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <polyline points="1,12 5,7 8,9 12,4 15,6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="15" cy="6" r="1.2" fill="currentColor"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 17, color: T1, letterSpacing: "-0.01em" }}>QuantAI</span>
          </div>

          {/* Centre content */}
          <div>
            {/* Mini chart decoration — uses deterministic MINI_CANDLES constant, no Math.random() */}
            <div style={{ marginBottom: 32, position: "relative", height: 80 }}>
              <svg viewBox="0 0 280 80" style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lg-left" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={UP} stopOpacity="0.2"/>
                    <stop offset="100%" stopColor={UP} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path
                  d="M0,65 C20,60 35,55 55,45 C75,35 85,48 105,38 C125,28 140,20 160,22 C180,24 195,15 215,10 C235,5 255,12 280,8"
                  fill="none" stroke={UP} strokeWidth="1.5" strokeLinecap="round"
                />
                <path
                  d="M0,65 C20,60 35,55 55,45 C75,35 85,48 105,38 C125,28 140,20 160,22 C180,24 195,15 215,10 C235,5 255,12 280,8 L280,80 L0,80 Z"
                  fill="url(#lg-left)"
                />
                <circle cx="280" cy="8" r="3" fill={UP}/>

                {/* Deterministic candles — no Math.random() */}
                {MINI_CANDLES.map(({ x, h, up }) => (
                  <g key={x}>
                    <line
                      x1={x} y1={55 - h - 4}
                      x2={x} y2={59}
                      stroke={up ? UP : DN}
                      strokeWidth="0.8"
                    />
                    <rect
                      x={x - 3} y={55 - h}
                      width={6} height={h || 2}
                      fill={up ? UP : DN}
                      opacity="0.5"
                    />
                  </g>
                ))}
              </svg>
            </div>

            <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: "clamp(26px,2.5vw,36px)", color: T1, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 16 }}>
              Make smarter<br/>
              <span style={{ fontStyle: "italic", color: T2 }}>investment decisions.</span>
            </h2>
            <p style={{ fontSize: 14, color: T2, lineHeight: 1.7, marginBottom: 32, fontWeight: 300, maxWidth: 340 }}>
              AI-powered portfolio analysis, real-time market data, and advanced algorithms — all in one platform.
            </p>

            {/* Feature list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {FEATURES.map((f, i) => (
                <div key={i} className="check-row">
                  <div className="check-icon">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={UP} strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, color: T2, fontWeight: 300 }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Stats row */}
        
          </div>

          <p style={{ fontSize: 12, color: T3 }}>© 2026 QuantAI. Built for serious investors.</p>
        </div>

        {/* ── RIGHT — Login form ── */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          background: "rgba(17,17,17,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}>
          <div style={{ width: "100%", maxWidth: 400 }}>

            {/* Logo (visible on mobile) */}
            <div className="lfu1" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: T1, color: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <polyline points="1,12 5,7 8,9 12,4 15,6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="15" cy="6" r="1.2" fill="currentColor"/>
                </svg>
              </div>
              <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: T1 }}>QuantAI</span>
            </div>

            {/* Heading */}
            <div className="lfu2" style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: T3, fontWeight: 500, letterSpacing: "0.07em", marginBottom: 8 }}>WELCOME BACK</div>
              <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: "clamp(26px,3vw,34px)", color: T1, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                Log in to your<br/>
                <span style={{ fontStyle: "italic", color: T2 }}>dashboard.</span>
              </h1>
            </div>

            {/* Session expiry banner */}
            {authMessage && (
              <div className="lfu3" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(196,148,58,0.1)", border: "0.5px solid rgba(196,148,58,0.3)", color: "#c4943a", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 20 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {authMessage}
              </div>
            )}

            {/* Form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <div className="lfu3">
                <label style={{ fontSize: 12, color: T3, display: "block", marginBottom: 6, fontWeight: 500, letterSpacing: "0.04em" }}>EMAIL</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                />
              </div>

              <div className="lfu4">
                <label style={{ fontSize: 12, color: T3, display: "block", marginBottom: 6, fontWeight: 500, letterSpacing: "0.04em" }}>PASSWORD</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    className="login-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    onClick={() => setShowPass(p => !p)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3, padding: 4, display: "flex", alignItems: "center" }}
                  >
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                    }
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(224,85,85,0.08)", border: "0.5px solid rgba(224,85,85,0.25)", color: DN, fontSize: 13, padding: "10px 14px", borderRadius: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <div className="lfu5">
                <button onClick={handleLogin} disabled={loading} className="login-btn">
                  {loading
                    ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        Logging in…
                      </span>
                    : "Log in to Dashboard"
                  }
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
              <div style={{ flex: 1, height: "0.5px", background: BDR }}/>
              <span style={{ fontSize: 11, color: T3 }}>New to QuantAI?</span>
              <div style={{ flex: 1, height: "0.5px", background: BDR }}/>
            </div>

            {/* Sign up CTA */}
            <button
              onClick={() => router.push("/signup")}
              style={{ width: "100%", background: "transparent", border: `0.5px solid ${BDR}`, color: T2, padding: "12px", borderRadius: 8, fontSize: 14, fontFamily: "inherit", cursor: "pointer", transition: "border-color .2s, color .2s" }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = T2;  (e.target as HTMLButtonElement).style.color = T1; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = BDR; (e.target as HTMLButtonElement).style.color = T2; }}
            >
              Create a free account
            </button>

            <p style={{ textAlign: "center", fontSize: 11, color: T3, marginTop: 24 }}>
              By continuing you agree to our Terms of Service
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}