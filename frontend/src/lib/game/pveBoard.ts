import { chebyshev } from "./duel";
import type {
  Cell,
  PveEncounterEvent,
  PveFieldType,
  PveMutationType,
  PveSkillUseRequest,
  SkillDirection,
  SkillType,
} from "@/lib/types/schemas";
import type { ToastType } from "@/lib/store/toast";

/**
 * PVE 棋盤關卡頁 — pure helpers (no React, no I/O). Mirrors the duel.ts split
 * ("pure logic shared by mock engine + UI") but for the PVE increment: this
 * file only needs client-side presentation/geometry helpers because the mock
 * engine (mocks/handlers/pveEngine.ts) does not simulate skill board geometry
 * for PVE (see its header comment) — skills here are bookkeeping-only
 * (hold quantity / interval gate), so there is no server state for this file
 * to mirror the way duel.ts mirrors duelEngine.ts.
 */

// PVE is always an 11x11 board (FR-C2; distinct from PVP's 15x15/16x16).
export const PVE_BOARD_ROWS = 11;
export const PVE_BOARD_COLS = 11;

// BEACH 場地固定「海側5行／沙側6行」(Run循環與場地排程.feature #6：⌊11/2⌋=5)。
// api.yml/PveEncounterStateResponse 沒有 erosion/oceanSide 欄位，且 mock engine
// 從未模擬海浪/漲潮（WAVE_SURGED/TIDE_TRIGGERED 從未被 push，見 pveEngine.ts
// placePveMove），故這裡只能渲染「固定分界」，無法做漸進式邊界推進動畫——這是
// 一個已知的 API/mock 缺口，見本次交付回報。
export const PVE_BEACH_OCEAN_ROWS = 5;

export const cellKey = (row: number, col: number) => `${row},${col}`;

export function cellSetFrom(cells: Cell[]): Set<string> {
  return new Set(cells.map((c) => cellKey(c.row, c.col)));
}

// ── Skill selection state machine ───────────────────────────────
export type PveSkillFlowMode = "axis" | "ultimate" | "target" | "scatter";

export const PVE_SKILL_MODE: Record<SkillType, PveSkillFlowMode> = {
  HORIZONTAL_SLASH: "axis",
  VERTICAL_SLASH: "axis",
  HEAVEN_EARTH_REVERSAL: "ultimate",
  PRECISION_SNIPE: "target",
  SCATTER_SHOT: "scatter",
  PIONEER_STAR: "ultimate",
};

// 橫劈=UP/DOWN；縱劈=LEFT/RIGHT（schemas.ts PveSkillUseRequest 註解）；大絕四向皆可。
export const PVE_SKILL_DIRECTIONS: Record<SkillType, SkillDirection[]> = {
  HORIZONTAL_SLASH: ["UP", "DOWN"],
  VERTICAL_SLASH: ["LEFT", "RIGHT"],
  HEAVEN_EARTH_REVERSAL: ["UP", "DOWN", "LEFT", "RIGHT"],
  PIONEER_STAR: ["UP", "DOWN", "LEFT", "RIGHT"],
  PRECISION_SNIPE: [],
  SCATTER_SHOT: [],
};

export const PVE_DIR_LABEL: Record<SkillDirection, string> = {
  UP: "上",
  DOWN: "下",
  LEFT: "左",
  RIGHT: "右",
};

/** SCATTER_SHOT's two picks must be >=2 apart (Chebyshev; schemas.ts comment). */
export const SCATTER_MIN_DISTANCE = 2;
export function scatterDistanceOk(a: Cell, b: Cell): boolean {
  return chebyshev(a, b) >= SCATTER_MIN_DISTANCE;
}

export interface PveSkillFlow {
  skillType: SkillType;
  mode: PveSkillFlowMode;
  stage: "direction" | "anchor" | "target" | "first" | "second" | "ready";
  direction?: SkillDirection;
  anchor?: Cell;
  target?: Cell;
  secondStone?: Cell;
}

/** Starts the input-collection flow for a skill button press. */
export function startSkillFlow(skillType: SkillType): PveSkillFlow {
  const mode = PVE_SKILL_MODE[skillType];
  if (mode === "target") return { skillType, mode, stage: "target" };
  if (mode === "scatter") return { skillType, mode, stage: "first" };
  // axis + ultimate both start by picking a direction
  return { skillType, mode, stage: "direction" };
}

export function buildSkillRequest(flow: PveSkillFlow): PveSkillUseRequest {
  return {
    skillType: flow.skillType,
    direction: flow.direction ?? null,
    anchor: flow.anchor ?? null,
    target: flow.target ?? null,
    secondStone: flow.secondStone ?? null,
  };
}

/** Cells already picked as part of an in-progress skill flow (board highlight). */
export function skillFlowPreviewCells(flow: PveSkillFlow | null): Cell[] {
  if (!flow) return [];
  const cells: Cell[] = [];
  if (flow.anchor) cells.push(flow.anchor);
  if (flow.target) cells.push(flow.target);
  if (flow.secondStone) cells.push(flow.secondStone);
  return cells;
}

// ── Display labels ───────────────────────────────────────────────
export const PVE_FIELD_LABEL: Record<PveFieldType, string> = {
  PLAIN: "平原",
  VOLCANO: "火山",
  BEACH: "海灘",
};

export const PVE_MUTATION_LABEL: Record<PveMutationType, string> = {
  NONE: "",
  ONE_EYE: "獨眼：橫向連線不結算",
  RAGE: "震怒：每落5手隨機噴發清除周圍棋子",
  ABYSS: "深淵：每次連線結算後隨機生成障礙棋子",
};

export const PVE_MUTATION_ICON: Record<PveMutationType, string> = {
  NONE: "",
  ONE_EYE: "👁️",
  RAGE: "😡",
  ABYSS: "🕳️",
};

// ── Event → toast presentation ──────────────────────────────────
// `enc.events` on every /moves or /use-skill response describes ONLY what
// happened in *this* call (pveEngine.ts resets `enc.events` at the start of
// each action) — never an accumulated history. LINE_RESOLVED/ENCOUNTER_*
// are intentionally not toast-mapped here: the caller shows a damage float
// for lines (lastResolution) and a dedicated clear/fail overlay for the
// encounter-ending events instead of a generic toast.
export function presentPveEvent(
  ev: PveEncounterEvent,
): { msg: string; type: ToastType } | null {
  switch (ev.eventType) {
    case "SKILL_USED":
      return { msg: "技能已施放", type: "skill" };
    case "VOLCANO_ERUPTED":
      return { msg: "火山噴發！", type: "error" };
    case "WAVE_SURGED":
      return { msg: "海浪來襲，棋子被推向岸邊", type: "tide" };
    case "TIDE_TRIGGERED":
      return { msg: "漲潮：海洋範圍持續侵蝕", type: "tide" };
    case "BOSS_MUTATION_TRIGGERED":
      return { msg: "Boss 突變效果觸發！", type: "error" };
    case "LINE_RESOLVED":
    case "STONES_PUSHED":
    case "STONE_REMOVED_OFF_BOARD":
    case "ENCOUNTER_CLEARED":
    case "ENCOUNTER_FAILED":
      return null;
    default:
      return null;
  }
}
