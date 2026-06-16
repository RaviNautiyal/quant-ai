"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter }       from "next/navigation";
import { FiSend, FiUser }  from "react-icons/fi";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketBadge }     from "@/hooks/MarketUI";
import { apiPost }         from "@/lib/apiFetch";
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
const AMB    = "#c4943a";
const UP_BG  = "rgba(61,186,106,0.08)";
const UP_BDR = "rgba(61,186,106,0.20)";
const AMB_BG = "rgba(196,148,58,0.08)";
const AMB_BDR= "rgba(196,148,58,0.20)";

interface Message { role: "user" | "model"; text: string; }

const SUGGESTIONS = [
  "Analyse RELIANCE for swing trade",
  "Is NIFTY in a bullish trend right now?",
  "Review my portfolio and suggest what to exit",
  "Best sectors to invest in current market?",
  "Find a stock near golden cross on NSE",
  "What is the trade setup for HDFCBANK?",
];

/* ─── Markdown renderer ─────────────────────────────────────────── */
function MarkdownText({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {text.split("\n").map((line, i) => {
        const html = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        if (line.startsWith("### "))
          return <p key={i} style={{ fontSize: 12, fontWeight: 600, color: UP, marginTop: 8 }} dangerouslySetInnerHTML={{ __html: html.slice(4) }} />;
        if (line.startsWith("## "))
          return <p key={i} style={{ fontSize: 13, fontWeight: 600, color: T1, marginTop: 8 }} dangerouslySetInnerHTML={{ __html: html.slice(3) }} />;
        if (/^[📊📈🎯🧠⚠️🔥💡]/.test(line))
          return <p key={i} style={{ fontSize: 12, fontWeight: 600, color: UP, marginTop: 8 }} dangerouslySetInnerHTML={{ __html: html }} />;
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: T3, flexShrink: 0, marginTop: 1 }}>·</span>
              <span style={{ fontSize: 13, color: T2, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
            </div>
          );
        if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
        return <p key={i} style={{ fontSize: 13, color: T2, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

/* ── AI icon ── */
function AIIcon({ size = 14, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: pulse ? "ai-pulse 1.5s ease-in-out infinite" : "none" }}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function AIPage() {
  const router       = useRouter();
  const marketStatus = useMarketStatus();

  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [queriesUsed,  setQueriesUsed]  = useState<number | null>(null);
  const [queriesLimit, setQueriesLimit] = useState<number | null>(null);
  const [limitHit,     setLimitHit]     = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    try {
      const saved = localStorage.getItem("ai_chat_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try { localStorage.setItem("ai_chat_history", JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (override?: string) => {
    const text = (override || input).trim();
    if (!text || loading || limitHit) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    const history = messages.map(m => ({ role: m.role === "user" ? "user" : "model", text: m.text }));
    try {
      const data = await apiPost("/ai/chat", { message: text, history });
      setMessages(prev => [...prev, { role: "model", text: data.response }]);
      if (data.queries_used  != null) setQueriesUsed(data.queries_used);
      if (data.queries_limit != null) setQueriesLimit(data.queries_limit);
      if (data.limit_reached)         setLimitHit(true);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Connection error. Please check the backend is running." }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([]); setLimitHit(false);
    try { localStorage.removeItem("ai_chat_history"); } catch {}
  };

  return (
    <>
      <ParticleCanvas />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111111; overflow-x: clip; }

        @keyframes bounce-d  { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes ai-pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fade-up   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin      { to{transform:rotate(360deg)} }

        .msg-in  { animation: fade-up .3s ease-out both; }

        .sugg-btn {
          background: ${CARD}; border: 0.5px solid ${BDR}; border-radius: 10px;
          padding: 12px 14px; text-align: left; font-size: 13px; color: ${T2};
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: border-color .15s, color .15s, background .15s;
          backdrop-filter: blur(8px);
        }
        .sugg-btn:hover { border-color: ${UP_BDR}; color: ${T1}; background: ${UP_BG}; }

        .send-btn {
          flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          border: none; cursor: pointer; transition: opacity .15s, transform .15s;
        }
        .send-btn:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
        .send-btn:disabled { cursor: not-allowed; }

        .clear-btn {
          background: none; border: none; cursor: pointer;
          font-size: 12px; color: ${T3}; font-family: 'DM Sans', sans-serif;
          padding: 4px 8px; border-radius: 5px;
          transition: color .15s;
        }
        .clear-btn:hover { color: ${T2}; }

        .chat-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 13px; color: ${T1}; font-family: 'DM Sans', sans-serif;
          resize: none; line-height: 1.6;
        }
        .chat-input::placeholder { color: ${T3}; }

        .dot1 { animation: bounce-d 1.2s ease-in-out infinite; animation-delay: 0ms; }
        .dot2 { animation: bounce-d 1.2s ease-in-out infinite; animation-delay: 150ms; }
        .dot3 { animation: bounce-d 1.2s ease-in-out infinite; animation-delay: 300ms; }

        /* messages scrollbar */
        .msg-scroll::-webkit-scrollbar { width: 4px; }
        .msg-scroll::-webkit-scrollbar-track { background: transparent; }
        .msg-scroll::-webkit-scrollbar-thumb { background: ${BDR}; border-radius: 2px; }
      `}</style>

      {/* Full-height flex column */}
      <div style={{
        position:      "relative",
        zIndex:        4,
        height:        "100vh",
        display:       "flex",
        flexDirection: "column",
        fontFamily:    "'DM Sans', sans-serif",
        color:         T1,
        overflow:      "hidden",
      }}>

        {/* ── HEADER ── */}
        <div style={{
          borderBottom:  `0.5px solid ${BDR}`,
          padding:       "12px 20px",
          display:       "flex",
          alignItems:    "center",
          justifyContent:"space-between",
          flexShrink:    0,
          background:    "rgba(17,17,17,0.80)",
          backdropFilter:"blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* AI icon */}
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: UP_BG, border: `0.5px solid ${UP_BDR}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: UP, flexShrink: 0,
            }}>
              <AIIcon size={15} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, color: T1, letterSpacing: "-0.01em" }}>
                  AI Trading Advisor
                </span>
                <MarketBadge status={marketStatus} />
              </div>
              <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>Gemini · NSE/BSE · Angel One data</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Query counter */}
            {queriesLimit != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: T3 }}>{queriesUsed}/{queriesLimit} today</span>
                <div style={{ width: 56, height: 3, background: SURF, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 2, background: UP,
                    width: `${((queriesUsed || 0) / (queriesLimit || 5)) * 100}%`,
                    transition: "width .4s ease",
                  }} />
                </div>
              </div>
            )}
            {messages.length > 0 && (
              <button className="clear-btn" onClick={clearChat}>Clear</button>
            )}
          </div>
        </div>

        {/* ── MESSAGES ── */}
        <div className="msg-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Empty state */}
          {messages.length === 0 && (
            <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", paddingTop: 24 }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: UP_BG, border: `0.5px solid ${UP_BDR}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px", color: UP,
                }}>
                  <AIIcon size={22} />
                </div>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(20px,3vw,26px)", color: T1, letterSpacing: "-0.02em", marginBottom: 6 }}>
                  Elite Quant Advisor
                </h2>
                <p style={{ fontSize: 13, color: T3 }}>
                  NSE/BSE focused · Structured trade setups · Portfolio analysis
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="sugg-btn" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className="msg-in" style={{
              display:        "flex",
              gap:            10,
              maxWidth:       720,
              width:          "100%",
              margin:         "0 auto",
              flexDirection:  msg.role === "user" ? "row-reverse" : "row",
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0, marginTop: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: msg.role === "user" ? "rgba(240,240,238,0.08)" : UP_BG,
                border: `0.5px solid ${msg.role === "user" ? BDR : UP_BDR}`,
                color: msg.role === "user" ? T2 : UP,
              }}>
                {msg.role === "user" ? <FiUser size={12} /> : <AIIcon size={12} />}
              </div>

              {/* Bubble */}
              <div style={{
                borderRadius: 10,
                padding:      "10px 14px",
                maxWidth:     "86%",
                background:   msg.role === "user" ? "rgba(240,240,238,0.06)" : CARD,
                border:       `0.5px solid ${msg.role === "user" ? BDR : BDR}`,
                backdropFilter: "blur(8px)",
              }}>
                {msg.role === "user"
                  ? <p style={{ fontSize: 13, color: T1, lineHeight: 1.6 }}>{msg.text}</p>
                  : <MarkdownText text={msg.text} />
                }
              </div>
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", gap: 10, maxWidth: 720, width: "100%", margin: "0 auto" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", background: UP_BG, border: `0.5px solid ${UP_BDR}`, color: UP }}>
                <AIIcon size={12} pulse />
              </div>
              <div style={{ borderRadius: 10, padding: "12px 16px", background: CARD, border: `0.5px solid ${BDR}`, backdropFilter: "blur(8px)" }}>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <span className="dot1" style={{ width: 6, height: 6, borderRadius: "50%", background: T3, display: "inline-block" }} />
                  <span className="dot2" style={{ width: 6, height: 6, borderRadius: "50%", background: T3, display: "inline-block" }} />
                  <span className="dot3" style={{ width: 6, height: 6, borderRadius: "50%", background: T3, display: "inline-block" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── INPUT ── */}
        <div style={{
          borderTop:     `0.5px solid ${BDR}`,
          padding:       "14px 20px",
          flexShrink:    0,
          background:    "rgba(17,17,17,0.80)",
          backdropFilter:"blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {/* Limit banner */}
            {limitHit && (
              <div style={{
                marginBottom: 10, padding: "9px 14px", borderRadius: 8,
                background: AMB_BG, border: `0.5px solid ${AMB_BDR}`,
                fontSize: 12, color: AMB,
              }}>
                Daily limit reached · Upgrade to Pro for unlimited AI access
              </div>
            )}

            {/* Input box */}
            <div style={{
              display:     "flex",
              alignItems:  "flex-end",
              gap:         10,
              background:  limitHit ? "rgba(255,255,255,0.02)" : CARD,
              border:      `0.5px solid ${BDR}`,
              borderRadius: 10,
              padding:     "10px 12px",
              backdropFilter: "blur(8px)",
              opacity:     limitHit ? 0.5 : 1,
              transition:  "border-color .2s",
            }}
              onFocus={() => {}}
            >
              <textarea
                ref={inputRef}
                rows={1}
                className="chat-input"
                placeholder={limitHit ? "Daily limit reached" : "Ask about any NSE/BSE stock, portfolio, or trade setups…"}
                value={input}
                disabled={limitHit}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKeyDown}
              />
              <button
                className="send-btn"
                disabled={loading || !input.trim() || limitHit}
                onClick={() => sendMessage()}
                style={{
                  background: input.trim() && !loading && !limitHit ? T1 : SURF,
                  color:      input.trim() && !loading && !limitHit ? BG  : T3,
                }}
              >
                <FiSend size={14} />
              </button>
            </div>

            <p style={{ fontSize: 10, color: T3, marginTop: 8, textAlign: "center", letterSpacing: "0.02em" }}>
              Shift+Enter for new line · Enter to send · Powered by Gemini
            </p>
          </div>
        </div>

      </div>
    </>
  );
}