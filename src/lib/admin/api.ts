"use client";

import { markAllStale } from "./cache";

/**
 * HTTP client for the GH Trust staff API.
 *
 * Staff sessions: a short-lived access token held ONLY in memory, plus a rotating
 * refresh token that the browser keeps in an httpOnly cookie (page scripts can't
 * read it). On `401 TOKEN_INVALID` a request refreshes once through the cookie
 * (shared by concurrent requests) and retries; any other 401 ends the session.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: unknown[];

  constructor(message: string, status: number, code?: string, errors?: unknown[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

// ── Token store (memory only) ─────────────────────────────────────────────

type Listener = (access: string | null) => void;
const listeners = new Set<Listener>();
let memoryAccess: string | null = null;

export const tokenStore = {
  get access() {
    return memoryAccess;
  },
  set(access: string) {
    memoryAccess = access;
    listeners.forEach((l) => l(access));
  },
  clear() {
    if (memoryAccess === null) return;
    memoryAccess = null;
    listeners.forEach((l) => l(null));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Headers/credentials for calls that read or set the refresh cookie. */
export const COOKIE_TRANSPORT: RequestInit = {
  credentials: "include",
  headers: { "X-Token-Transport": "cookie" },
};

// ── Requests ──────────────────────────────────────────────────────────────

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json();
    const code = typeof data.code === "string" ? data.code : undefined;
    const errors = Array.isArray(data.errors) ? data.errors : undefined;
    let message: string;
    if (typeof data.detail === "string") message = data.detail;
    else if (Array.isArray(data.detail)) {
      message = data.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(", ");
    } else message = res.statusText || "Request failed";
    return new ApiError(message, res.status, code, errors);
  } catch {
    return new ApiError(res.statusText || "Request failed", res.status);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** Get a new access token using the httpOnly refresh cookie. Single-flight. */
export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/admin/auth/token/refresh`, { method: "POST", ...COOKIE_TRANSPORT });
        if (!res.ok) return false;
        const data = (await res.json()) as { access_token: string };
        tokenStore.set(data.access_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions extends RequestInit {
  /** Send the staff bearer token (default true). */
  auth?: boolean;
}

async function send(path: string, options: RequestOptions, retried: boolean): Promise<Response> {
  const { auth = true, ...init } = options;
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const bearer = auth ? tokenStore.access : null;
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.ok) {
    if (init.method && init.method !== "GET") markAllStale();
    return res;
  }

  const err = await parseError(res);
  if (res.status === 401 && bearer) {
    if (err.code === "TOKEN_INVALID" && !retried && (await refreshAccessToken())) {
      return send(path, options, true);
    }
    tokenStore.clear(); // revoked session, deactivated account, or refresh failed
  }
  throw err;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options, false);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** GET a list endpoint that reports its total in the X-Total-Count header. */
export async function apiWithTotal<T>(path: string): Promise<{ items: T; total: number }> {
  const res = await send(path, {}, false);
  const items = (await res.json()) as T;
  const total = Number(res.headers.get("X-Total-Count") ?? (Array.isArray(items) ? items.length : 0));
  return { items, total };
}

/** Download an authenticated file (documents, CSV exports) and save it. */
export async function downloadFile(path: string, fileName: string): Promise<void> {
  const res = await send(path, {}, false);
  const url = URL.createObjectURL(await res.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function query(params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}
