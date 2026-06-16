"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/apiFetch";

export default function TokenRefresher() {
  useEffect(() => {
    const refreshToken = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const data = await apiFetch("/auth/refresh");
        localStorage.setItem("token", data.token);
      } catch {
        // 401 → apiFetch already redirects to /login
      }
    };

    refreshToken();
    const id = setInterval(refreshToken, 12 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return null; // renders nothing, just runs the effect
}