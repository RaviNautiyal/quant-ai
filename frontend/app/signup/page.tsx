"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ParticleCanvas from "@/components/ParticleCanvas";

const BG   = "#111111";
const SURF = "#222222";
const BDR  = "#2c2c2c";
const T1   = "#f0f0ee";
const T2   = "#888884";
const T3   = "#555552";
const UP   = "#3dba6a";
const DN   = "#e05555";

const STATS = [
  { value: "Free", label: "To get started"   },
  { value: "AI",   label: "Powered analysis"  },
  { value: "Live", label: "Market data"       },
  { value: "6+",   label: "DSA Algorithms"    },
];

/* ── Deterministic candle data — no Math.random(), no hydration mismatch ── */
const SIGNUP_CANDLES = [
  { x: 30,  h: 8,  up: true  },
  { x: 70,  h: 11, up: false },
  { x: 110, h: 14, up: true  },
  { x: 150, h: 9,  up: true  },
  { x: 190, h: 12, up: false },
  { x: 230, h: 17, up: true  },
];

export default function Signup() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const handleSignup = async () => {
    if (!email || !password) return;
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(process.env.NEXT_PUBLIC_API_URL + "/auth/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Signup failed"); setLoading(false); return; }
      router.push("/login");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  /* Password strength */
  const strength      = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"];
  const strengthColor = ["", DN, "#c4943a", UP];

  const EyeOpen = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const EyeOff = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: T1, fontFamily: "'DM Sans','Helvetica Neue',sans-serif", position: "relative", overflowX: "clip" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: clip; max-width: 100%; background: #111111; }

        @keyframes fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin     { to   { transform: rotate(360deg); } }

        /* Hide browser native password reveal */
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear,
        input::-webkit-credentials-auto-fill-button,
        input[type="password"]::-webkit-textfield-decoration-container { display: none !important; }

        .sfu1 { animation: fade-up 0.5s ease both 0.05s; }
        .sfu2 { animation: fade-up 0.5s ease both 0.12s; }
        .sfu3 { animation: fade-up 0.5s ease both 0.20s; }
        .sfu4 { animation: fade-up 0.5s ease both 0.28s; }
        .sfu5 { animation: fade-up 0.5s ease both 0.36s; }
        .sfu6 { animation: fade-up 0.5s ease both 0.44s; }

        .signup-input {
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
        .signup-input::placeholder { color: ${T3}; }
        .signup-input:focus { border-color: ${T2}; background: #2a2a2a; }

        .signup-btn {
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
        .signup-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .signup-btn:active:not(:disabled) { transform: scale(0.99); }
        .signup-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .show-btn {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: ${T3};
          padding: 4px; display: flex; align-items: center;
          transition: color 0.15s;
        }
        .show-btn:hover { color: ${T2}; }

        .ghost-btn {
          width: 100%;
          background: transparent;
          border: 0.5px solid ${BDR};
          color: ${T2};
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
        }
        .ghost-btn:hover { border-color: ${T2}; color: ${T1}; }

        .stat-card {
          background: rgba(34,34,34,0.5);
          border: 0.5px solid ${BDR};
          border-radius: 10px;
          padding: 14px 16px;
          backdrop-filter: blur(4px);
        }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>

      <ParticleCanvas />

      {/* ── Layout ── */}
      <div style={{ display: "flex", width: "100%", minHeight: "100vh", position: "relative", zIndex: 2 }}>

        {/* ── LEFT — Branding ── */}
        <div
          className="hide-mobile"
          style={{
            flex: "0 0 50%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "40px 48px",
            background: "rgba(26,26,26,0.35)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
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

          {/* Centre */}
          <div>
            {/* Decorative chart — fully deterministic, no hydration risk */}
            <div style={{ marginBottom: 32, position: "relative", height: 80 }}>
              <svg viewBox="0 0 280 80" style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lg-signup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={UP} stopOpacity="0.22"/>
                    <stop offset="100%" stopColor={UP} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path
                  d="M0,70 C18,64 30,58 50,50 C70,42 82,52 100,42 C118,32 132,22 152,20 C172,18 188,26 208,16 C228,6 252,10 280,5"
                  fill="none" stroke={UP} strokeWidth="1.5" strokeLinecap="round"
                />
                <path
                  d="M0,70 C18,64 30,58 50,50 C70,42 82,52 100,42 C118,32 132,22 152,20 C172,18 188,26 208,16 C228,6 252,10 280,5 L280,80 L0,80 Z"
                  fill="url(#lg-signup)"
                />
                <circle cx="280" cy="5" r="3" fill={UP}/>

                {/* Deterministic candles — no Math.random() */}
                {SIGNUP_CANDLES.map(({ x, h, up }) => (
                  <g key={x}>
                    <line
                      x1={x} y1={60 - h - 5}
                      x2={x} y2={64}
                      stroke={up ? UP : DN}
                      strokeWidth="0.8"
                      opacity="0.6"
                    />
                    <rect
                      x={x - 3} y={60 - h}
                      width={6} height={h || 2}
                      fill={up ? UP : DN}
                      opacity="0.45"
                    />
                  </g>
                ))}
              </svg>
            </div>

            <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: "clamp(26px,2.5vw,36px)", color: T1, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 14 }}>
              Start investing<br/>
              <span style={{ fontStyle: "italic", color: T2 }}>smarter today.</span>
            </h2>
            <p style={{ fontSize: 14, color: T2, lineHeight: 1.7, marginBottom: 32, fontWeight: 300, maxWidth: 340 }}>
              Join thousands of investors using AI to analyse markets, track portfolios and make data-driven decisions.
            </p>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {STATS.map((s, i) => (
                <div key={i} className="stat-card">
                  <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: UP, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: T3, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 12, color: T3 }}>© 2025 QuantAI. Built for serious investors.</p>
        </div>

        {/* ── RIGHT — Signup form ── */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          background: "rgba(17,17,17,0.30)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}>
          <div style={{ width: "100%", maxWidth: 400 }}>

            {/* Mobile logo */}
            <div className="sfu1" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: T1, color: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <polyline points="1,12 5,7 8,9 12,4 15,6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="15" cy="6" r="1.2" fill="currentColor"/>
                </svg>
              </div>
              <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: T1 }}>QuantAI</span>
            </div>

            {/* Heading */}
            <div className="sfu2" style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: T3, fontWeight: 500, letterSpacing: "0.07em", marginBottom: 8 }}>GET STARTED</div>
              <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: "clamp(26px,3vw,34px)", color: T1, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                Create your<br/>
                <span style={{ fontStyle: "italic", color: T2 }}>free account.</span>
              </h1>
              <p style={{ fontSize: 13, color: T3, marginTop: 8, fontWeight: 300 }}>No credit card required.</p>
            </div>

            {/* Form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Email */}
              <div className="sfu3">
                <label style={{ fontSize: 12, color: T3, display: "block", marginBottom: 6, fontWeight: 500, letterSpacing: "0.04em" }}>EMAIL</label>
                <input
                  type="email"
                  className="signup-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSignup()}
                />
              </div>

              {/* Password */}
              <div className="sfu4">
                <label style={{ fontSize: 12, color: T3, display: "block", marginBottom: 6, fontWeight: 500, letterSpacing: "0.04em" }}>PASSWORD</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    className="signup-input"
                    placeholder="Min 6 characters"
                    value={password}
                    style={{ paddingRight: 44 }}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button className="show-btn" onClick={() => setShowPass(p => !p)} type="button">
                    {showPass ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3].map(level => (
                        <div key={level} style={{
                          flex: 1, height: 2, borderRadius: 1,
                          background: strength >= level ? strengthColor[strength] : SURF,
                          transition: "background 0.3s",
                        }}/>
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: strengthColor[strength] }}>{strengthLabel[strength]}</span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="sfu5">
                <label style={{ fontSize: 12, color: T3, display: "block", marginBottom: 6, fontWeight: 500, letterSpacing: "0.04em" }}>CONFIRM PASSWORD</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConf ? "text" : "password"}
                    className="signup-input"
                    placeholder="Re-enter password"
                    value={confirm}
                    style={{
                      paddingRight: 72,
                      borderColor: confirm.length > 0
                        ? confirm === password ? "rgba(61,186,106,0.4)" : "rgba(224,85,85,0.4)"
                        : BDR,
                    }}
                    onChange={e => setConfirm(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSignup()}
                  />
                  {/* Match indicator */}
                  {confirm.length > 0 && (
                    <div style={{ position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)" }}>
                      {confirm === password
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={UP} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DN} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      }
                    </div>
                  )}
                  <button className="show-btn" onClick={() => setShowConf(p => !p)} type="button">
                    {showConf ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>

              {/* Error */}
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

              {/* Submit */}
              <div className="sfu6">
                <button onClick={handleSignup} disabled={loading} className="signup-btn">
                  {loading
                    ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        Creating account…
                      </span>
                    : "Create Free Account"
                  }
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
              <div style={{ flex: 1, height: "0.5px", background: BDR }}/>
              <span style={{ fontSize: 11, color: T3 }}>Already have an account?</span>
              <div style={{ flex: 1, height: "0.5px", background: BDR }}/>
            </div>

            {/* Login CTA */}
            <button onClick={() => router.push("/login")} className="ghost-btn">
              Log in instead
            </button>

            <p style={{ textAlign: "center", fontSize: 11, color: T3, marginTop: 24 }}>
              By signing up you agree to our Terms of Service
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}