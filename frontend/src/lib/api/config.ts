/**
 * API base path — mirrors specs/api.yml `servers.url`:
 *   /api/{system-code}/{api-version}  (defaults gmk / v1)
 * Overridable via NEXT_PUBLIC_API_BASE for real backend wiring.
 */
export const SYSTEM_CODE = process.env.NEXT_PUBLIC_SYSTEM_CODE ?? "gmk";
export const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION ?? "v1";
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? `/api/${SYSTEM_CODE}/${API_VERSION}`;

/** STOMP / SockJS endpoint (real-time channels, see api.yml x-stomp-channels). */
export const WS_ENDPOINT =
  process.env.NEXT_PUBLIC_WS_ENDPOINT ?? "/ws";

/** Whether the MSW mock layer should boot (backend not yet online). */
export const USE_MOCKS =
  (process.env.NEXT_PUBLIC_API_MOCKING ?? "enabled") !== "disabled";
