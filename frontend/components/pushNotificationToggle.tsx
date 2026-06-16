"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

/* ─── Tokens ────────────────────────────────────────────────────── */
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

/* ── Toggle switch ───────────────────────────────────────────────── */
function Toggle({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-label={on ? "Disable push notifications" : "Enable push notifications"}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none",
        background: on ? UP : "rgba(255,255,255,0.12)",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", flexShrink: 0,
        transition: "background .2s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%",
        background: "#fff",
        transition: "left .2s cubic-bezier(0.34,1.56,0.64,1)",
        display: "block",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export function PushNotificationToggle() {
  const { status, error, subscribe, unsubscribe, sendTest } = usePushNotifications();

  const isGranted   = status === "granted";
  const isLoading   = status === "loading";
  const isDenied    = status === "denied";
  const isUnsupported = status === "unsupported";

  /* Browser doesn't support push at all */
  if (isUnsupported) {
    return (
      <div style={{
        fontSize: 11, color: T3, padding: "10px 14px",
        borderRadius: 8, background: "rgba(255,255,255,0.02)",
        border: `0.5px solid ${BDR}`,
      }}>
        Push notifications are not supported in this browser.
        Use Chrome or Edge on desktop for price alerts.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* ── Main toggle row ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 14, padding: "13px 16px", borderRadius: 10,
        background: isGranted ? UP_BG : "rgba(255,255,255,0.03)",
        border: `0.5px solid ${isGranted ? UP_BDR : BDR}`,
        transition: "all .2s",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500,
            color: isGranted ? UP : T2,
            marginBottom: 3,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {isLoading
              ? "Enabling…"
              : isGranted
              ? "🔔 Alerts enabled"
              : isDenied
              ? "🔕 Notifications blocked"
              : "🔕 Alerts disabled"}
          </div>
          <div style={{ fontSize: 11, color: T3, lineHeight: 1.5 }}>
            {isGranted
              ? "You'll get a push notification when a price target is hit"
              : isDenied
              ? "Blocked in browser — click the 🔒 icon in the address bar to allow"
              : "Enable to be notified when your price targets are hit"}
          </div>
        </div>

        <Toggle
          on={isGranted}
          disabled={isLoading || isDenied}
          onChange={isGranted ? unsubscribe : subscribe}
        />
      </div>

      {/* ── Denied banner ── */}
      {isDenied && (
        <div style={{
          fontSize: 11, color: DN,
          background: DN_BG, border: `0.5px solid ${DN_BDR}`,
          borderRadius: 8, padding: "9px 14px", lineHeight: 1.55,
        }}>
          <strong>Permission denied.</strong> To fix: click the 🔒 lock icon in your
          browser address bar → Site settings → Notifications → Allow.
          Then reload this page.
        </div>
      )}

      {/* ── Error banner (extension conflict etc.) ── */}
      {error && !isDenied && (
        <div style={{
          fontSize: 11, color: AMB,
          background: AMB_BG, border: `0.5px solid ${AMB_BDR}`,
          borderRadius: 8, padding: "9px 14px", lineHeight: 1.55,
        }}>
          {error}
          {error.includes("extension") && (
            <span style={{ display: "block", marginTop: 4, color: T3 }}>
              Try: open an Incognito window (Ctrl+Shift+N) and enable notifications there.
            </span>
          )}
        </div>
      )}

      {/* ── Test button (only shown when granted) ── */}
      {isGranted && (
        <button
          onClick={sendTest}
          style={{
            alignSelf: "flex-start",
            padding: "6px 14px", borderRadius: 7,
            background: "rgba(255,255,255,0.05)",
            border: `0.5px solid ${BDR}`,
            color: T3, fontSize: 11, fontWeight: 500,
            fontFamily: "'DM Sans',sans-serif",
            cursor: "pointer", transition: "all .15s",
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.color = T2;
            (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.color = T3;
            (e.target as HTMLElement).style.borderColor = BDR;
          }}
        >
          Send test notification
        </button>
      )}
    </div>
  );
}