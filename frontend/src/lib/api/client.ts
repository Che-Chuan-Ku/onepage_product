import { z } from "zod";
import { API_BASE } from "./config";
import { ManageResponse } from "@/lib/types/schemas";

/**
 * Thin typed fetch wrapper around the ManageResponse envelope (api.yml).
 * Every endpoint returns `{ status, code, message, data }`; this unwraps
 * `data` and validates it against the supplied Zod schema, so the UI only
 * ever sees parsed, typed payloads.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let authToken: string | null = null;
/** Set/clear the bearer token used for authenticated requests. */
export function setAuthToken(token: string | null) {
  authToken = token;
}
// 登入失效(401/403 且非業務錯誤)時的回呼，由 session store 註冊（清 session + 導回登入）。
let onUnauthorized: (() => void) | null = null;
let unauthorizedFiring = false;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export function getAuthToken() {
  if (authToken) return authToken;
  // Fallback: in-memory token is reset on a hard page load; read the persisted
  // session before zustand re-hydration runs, so an API call fired right after
  // load still carries auth (avoids a brief 401 window).
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("gmk-session");
      if (raw) {
        const tok = JSON.parse(raw)?.state?.token;
        if (typeof tok === "string" && tok) return tok;
      }
    } catch {
      /* ignore */
    }
  }
  return authToken;
}

interface RequestOptions<T extends z.ZodTypeAny> {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Zod schema for the `data` payload; omit when endpoint returns no data. */
  schema?: T;
  query?: Record<string, string | number | undefined>;
}

const Envelope = ManageResponse.extend({ data: z.unknown().optional() });

async function request<T extends z.ZodTypeAny>(
  path: string,
  opts: RequestOptions<T> = {},
): Promise<T extends z.ZodTypeAny ? z.infer<T> : undefined> {
  const { method = "GET", body, schema, query } = opts;

  let url = `${API_BASE}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tok = getAuthToken();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  const env = Envelope.safeParse(json);
  const code = env.success ? env.data.code : String(res.status);
  const message = env.success ? env.data.message : res.statusText;

  if (!res.ok) {
    // 安全層擋下(無/過期/無效 token) → 回 401/403 且**無** ManageResponse 信封；
    // 業務 403(如觀戰者按 Ready)有信封 → 不視為登入失效，照常拋業務錯誤。
    if ((res.status === 401 || res.status === 403) && !env.success && !unauthorizedFiring) {
      unauthorizedFiring = true;
      try {
        onUnauthorized?.();
      } finally {
        // 短暫鎖避免並發多個失敗請求重複觸發導向
        setTimeout(() => {
          unauthorizedFiring = false;
        }, 1500);
      }
    }
    throw new ApiError(res.status, code, message, env.success ? env.data.data : json);
  }

  if (!schema) return undefined as never;
  const parsed = schema.parse(env.success ? env.data.data : undefined);
  return parsed as never;
}

export const api = {
  get: <T extends z.ZodTypeAny>(path: string, schema: T, query?: RequestOptions<T>["query"]) =>
    request(path, { method: "GET", schema, query }),
  post: <T extends z.ZodTypeAny>(path: string, schema?: T, body?: unknown) =>
    request(path, { method: "POST", schema, body }),
};
