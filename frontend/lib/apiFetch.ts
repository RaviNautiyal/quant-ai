/**
 * apiFetch.ts
 * Drop-in replacement for fetch() across all authenticated pages.
 *
 * Usage:
 *   import { apiFetch } from "@/lib/apiFetch";
 *   const data = await apiFetch("/watchlist/all");
 *   const data = await apiFetch("/alerts/add", { method: "POST", body: JSON.stringify({...}) });
 *
 * - Automatically attaches Authorization: Bearer <token> header
 * - On 401: clears token, shows a toast, redirects to /login
 * - Supports all standard fetch options (method, body, headers, etc.)
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || localStorage.getItem("access_token");
}

function clearSession(reason: string) {
  localStorage.removeItem("token");
  localStorage.removeItem("access_token");
  // Store message so login page can display it
  sessionStorage.setItem("auth_message", reason);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearSession("Your session has expired. Please log in again.");
    // Redirect — works in both app/ and pages/ routers
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError("Unauthorised", 401);
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      detail = err.detail || err.message || detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }

  // Return null for 204 No Content
  if (res.status === 204) return null as T;

  return res.json();
}

/**
 * Convenience wrappers
 */
export const apiGet  = (path: string, opts?: RequestInit) =>
  apiFetch(path, { method: "GET", ...opts });

export const apiPost = (path: string, body: unknown, opts?: RequestInit) =>
  apiFetch(path, { method: "POST", body: JSON.stringify(body), ...opts });

export const apiDelete = (path: string, opts?: RequestInit) =>
  apiFetch(path, { method: "DELETE", ...opts });