"use client";

import React from "react";

const BDR = "#2c2c2c";
const T1  = "#f0f0ee";
const T2  = "#888884";
const T3  = "#555552";
const DN  = "#e05555";
const DN_BG  = "rgba(224,85,85,0.08)";
const DN_BDR = "rgba(224,85,85,0.20)";

interface Props   { children: React.ReactNode; fallback?: React.ReactNode; }
interface State   { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback)  return this.props.fallback;

    return (
      <div style={{
        minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 24px", fontFamily: "'DM Sans',sans-serif",
      }}>
        <div style={{
          maxWidth: 420, width: "100%", textAlign: "center",
          background: "rgba(26,26,26,0.85)", border: `0.5px solid ${BDR}`,
          borderRadius: 16, padding: "40px 32px",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.4 }}>⚠</div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: T1, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: T2, marginBottom: 20, lineHeight: 1.6 }}>
            This section failed to load. Your data is safe.
          </div>
          {this.state.error?.message && (
            <div style={{
              fontSize: 11, color: DN, background: DN_BG, border: `0.5px solid ${DN_BDR}`,
              borderRadius: 8, padding: "8px 12px", marginBottom: 20,
              fontFamily: "monospace", textAlign: "left", wordBreak: "break-word",
            }}>
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "10px 24px", borderRadius: 8, border: `0.5px solid ${BDR}`,
              background: "rgba(255,255,255,0.07)", color: T1,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", transition: "all .15s",
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}