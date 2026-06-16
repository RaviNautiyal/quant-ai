"use client";

import { useState, useEffect, useCallback } from "react";
import { apiPost } from "@/lib/apiFetch";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export type PushStatus = "idle" | "loading" | "granted" | "denied" | "unsupported";

/* ── Safe browser checks ─────────────────────────────────────────── */
const isBrowser      = () => typeof window !== "undefined";
const hasServiceWorker = () => isBrowser() && "serviceWorker" in navigator;
const hasPushManager   = () => isBrowser() && "PushManager" in window;
const hasNotification  = () => isBrowser() && "Notification" in window;
const isSupported      = () => hasServiceWorker() && hasPushManager() && hasNotification();

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output.buffer as ArrayBuffer;
}

function subToPayload(sub: PushSubscription) {
  const key  = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!key || !auth) throw new Error("Missing subscription keys");
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
      auth:   btoa(String.fromCharCode(...new Uint8Array(auth))),
    },
  };
}

/* ════════════════════════════════════════════════════════════════ */
export function usePushNotifications() {
  const [status,       setStatus]       = useState<PushStatus>("idle");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [error,        setError]        = useState<string>("");

  /* Check on mount — but only client-side, never SSR */
  useEffect(() => {
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }

    /* Already denied at browser level */
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    /* Check if already subscribed */
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (sub) {
          setSubscription(sub);
          setStatus("granted");
        }
        /* else leave as "idle" — user hasn't asked yet */
      })
      .catch(() => {
        /* SW not ready yet — fine, stay idle */
      });
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError("Push notifications not configured (missing VAPID key)");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      /* 1 — Register SW */
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      /* 2 — Request permission — must be from a user gesture */
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        setError("Notification permission denied. Enable it in browser settings.");
        return;
      }
      if (permission !== "granted") {
        setStatus("idle");
        return;
      }

      /* 3 — Subscribe to push */
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      /* 4 — Send subscription to backend */
      await apiPost("/push/subscribe", subToPayload(sub));

      setSubscription(sub);
      setStatus("granted");
    } catch (e: any) {
      console.error("[push]", e);
      setStatus("idle");
      /* Filter out the Chrome extension noise */
      const msg = e?.message || "";
      if (msg.includes("Breaking Browser") || msg.includes("chrome-extension")) {
        setError("A browser extension is interfering. Try in Incognito mode.");
      } else if (msg.includes("applicationServerKey")) {
        setError("Invalid VAPID key. Check NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local");
      } else {
        setError(msg || "Failed to enable notifications");
      }
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    try {
      const payload = subToPayload(subscription);
      await subscription.unsubscribe();
      await apiPost("/push/unsubscribe", { endpoint: payload.endpoint }).catch(() => {});
      setSubscription(null);
      setStatus("idle");
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to disable notifications");
    }
  }, [subscription]);

  const sendTest = useCallback(async () => {
    try {
      await apiPost("/push/test", {});
    } catch (e: any) {
      setError(e?.message || "Test failed");
    }
  }, []);

  return { status, subscription, error, subscribe, unsubscribe, sendTest };
}