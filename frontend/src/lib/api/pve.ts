import { api } from "./client";
import {
  PveRunCreateRequest,
  PveRunStateResponse,
  PveRunResultResponse,
  PveEncounterStateResponse,
  PveMoveCreateRequest,
  PveSkillUseRequest,
  PveShopStateResponse,
  PveShopPurchaseRequest,
  PveShopSkipResponse,
} from "@/lib/types/schemas";

/**
 * PVE 挑戰模式 API client — one function per api.yml `tags: [pve]` operationId
 * (documents/PVE-挑戰模式-增量需求.md). Mirrors the services.ts convention
 * (api.get/api.post + a Zod response schema per call) but is kept in its own
 * file rather than added to services.ts, per this increment's file-ownership
 * boundary (services.ts is owned by the PVP work and stays untouched here).
 *
 * PVE is single-request/response only — no STOMP channel exists for it
 * (api.yml x-stomp-channels lists none; see pve-api-spec.md §0.4).
 */
export const pveService = {
  /** POST /pve/runs — 建立挑戰 Run（同帳號同時至多1個進行中Run，否則422） */
  createRun: (body: PveRunCreateRequest) =>
    api.post("/pve/runs", PveRunStateResponse, body),

  /** GET /pve/runs/current — 供斷線/重新整理續玩；沒有進行中的 Run 時 404 */
  getCurrentRun: () => api.get("/pve/runs/current", PveRunStateResponse),

  /** POST /pve/runs/{runId}/actions/abandon — 主動放棄，視同失敗 */
  abandonRun: (runId: string) =>
    api.post(`/pve/runs/${runId}/actions/abandon`, PveRunResultResponse),

  /**
   * GET /pve/runs/{runId}/result — 查詢已結束 Run 的權威結算
   * (api.yml:833-875)。取代前端自行以 sessionStorage 推算
   * goldEarned/goldSpent/totalDamageDealt；僅限已結束
   * （WON/LOST/ABANDONED）的 Run 可查，仍進行中則 422。
   */
  getRunResult: (runId: string) =>
    api.get(`/pve/runs/${runId}/result`, PveRunResultResponse),

  /** GET /pve/encounters/{encounterId} — 查詢關卡狀態（供續玩恢復） */
  getEncounter: (encounterId: string) =>
    api.get(`/pve/encounters/${encounterId}`, PveEncounterStateResponse),

  /** POST /pve/encounters/{encounterId}/moves — 關卡落子（純落子，技能獨立） */
  placeMove: (encounterId: string, body: PveMoveCreateRequest) =>
    api.post(`/pve/encounters/${encounterId}/moves`, PveEncounterStateResponse, body),

  /** POST /pve/encounters/{encounterId}/actions/use-skill — 使用技能（消耗型、獨立行動） */
  useSkill: (encounterId: string, body: PveSkillUseRequest) =>
    api.post(
      `/pve/encounters/${encounterId}/actions/use-skill`,
      PveEncounterStateResponse,
      body,
    ),

  /** GET /pve/runs/{runId}/shop — 查詢商店展示（遺物x2、技能x1） */
  getShop: (runId: string) => api.get(`/pve/runs/${runId}/shop`, PveShopStateResponse),

  /** POST /pve/runs/{runId}/shop/actions/purchase — 依 slotIndex 購買 */
  purchaseShopOffer: (runId: string, body: PveShopPurchaseRequest) =>
    api.post(`/pve/runs/${runId}/shop/actions/purchase`, PveShopStateResponse, body),

  /** POST /pve/runs/{runId}/shop/actions/reroll — 固定花費5金幣，三位全換 */
  rerollShop: (runId: string) =>
    api.post(`/pve/runs/${runId}/shop/actions/reroll`, PveShopStateResponse),

  /**
   * POST /pve/runs/{runId}/shop/actions/skip — 跳過商店。
   * Response shape varies (api.yml has no oneOf): use
   * `"encounterId" in data` to discriminate encounter-vs-result (see
   * PveShopSkipResponse doc in schemas.ts).
   */
  skipShop: (runId: string) =>
    api.post(`/pve/runs/${runId}/shop/actions/skip`, PveShopSkipResponse),
};
