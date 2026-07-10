import { chebyshev } from "./duel";
import type {
  Cell,
  PveEncounterEvent,
  PveEncounterStateResponse,
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
    // BOSS_MOVE_PLACED（2026-07-09新增，DUEL關）：不用toast，用棋盤上的短暫
    // highlight（PveBoard bossLastMove prop）呈現「Boss剛下的這一手」即可，
    // 比通用toast更貼合「對局進行中」的節奏（§5.2）。
    case "BOSS_MOVE_PLACED":
      return null;
    default:
      return null;
  }
}

// ── 魔王對弈 DUEL 結算文案（documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §5.2）──
// DUEL 的 ENCOUNTER_FAILED 有兩種敗因（Boss連五 / 手數用盡），但 api.yml 的
// events[].eventType 沒有攜帶原因欄位——用 movesUsed/moveBudget 純推導即可
// 100%準確：DUEL 的手數用盡判定發生在「呼叫BossAiPolicy之前」（見後端
// PveChallengeService#settleDuel），所以 Boss連五導致的FAILED，movesUsed 必然
// 嚴格小於 moveBudget；反之手數用盡導致的FAILED，movesUsed 必然已達
// moveBudget——兩者互斥，不需要新的API欄位。
export type PveDuelFailReason = "BOSS_FIVE" | "MOVES_EXHAUSTED";

export function duelFailReason(enc: PveEncounterStateResponse): PveDuelFailReason | null {
  if (enc.encounterType !== "DUEL" || enc.status !== "FAILED") return null;
  return enc.movesUsed >= enc.moveBudget ? "MOVES_EXHAUSTED" : "BOSS_FIVE";
}

export const PVE_DUEL_FAIL_COPY: Record<PveDuelFailReason, string> = {
  BOSS_FIVE: "Boss 完成五連，你輸了",
  MOVES_EXHAUSTED: "手數已用盡，你輸了",
};

// ── DUEL 和局 DRAW（2026-07-09 §1.5/§6.5 公平性修正）─────────────────────
// 手數耗盡且雙方皆未連五：與FAILED不同，Run不會被沒收（仍IN_PROGRESS），前端
// 顯示「勢均力敵」提示並讓玩家呼叫 retryPveEncounter 原地重試（可無限次），
// 不導向結算頁。
export const PVE_DUEL_DRAW_COPY = "勢均力敵！再來一局";

// ── L3 不可橫向 即時回饋（§4.1 / §7.6 第二批 polish item #2）────────────────
// 橫向五連在 L3 不算勝——後端/mock 都只是「不判勝」，玩家看到的是「我連了五顆
// 卻沒贏」的沉默盤面。這裡把「湊成的那條橫向線」找出來，交給棋盤灰化/虛線
// 渲染＋toast 提示，雙方（玩家黑子、Boss 白子）皆適用。
export const PVE_HORIZONTAL_VOID_TOAST = "橫向連線不計勝負！";

/**
 * All cells belonging to a HORIZONTAL run of >=5 same-color stones, for both
 * colors — pure scan over the two stone lists (player stones vs boss
 * ENEMY_STONE cells). Only meaningful on an encounter with
 * `horizontalDisabled` (the caller gates on that).
 */
export function horizontalFiveCells(playerStones: Cell[], enemyStones: Cell[]): Cell[] {
  const found: Cell[] = [];
  for (const stones of [playerStones, enemyStones]) {
    const byRow = new Map<number, Set<number>>();
    for (const s of stones) {
      const cols = byRow.get(s.row) ?? new Set<number>();
      cols.add(s.col);
      byRow.set(s.row, cols);
    }
    byRow.forEach((cols, row) => {
      const sorted = Array.from(cols).sort((a, b) => a - b);
      let runStart = 0;
      for (let i = 1; i <= sorted.length; i++) {
        if (i < sorted.length && sorted[i] === sorted[i - 1] + 1) continue;
        const runLen = i - runStart;
        if (runLen >= 5) {
          for (let j = runStart; j < i; j++) found.push({ row, col: sorted[j] });
        }
        runStart = i;
      }
    });
  }
  return found;
}

/** DUEL関's most recent boss reply coordinate, or null if none yet this call. */
export function bossLastMoveFrom(enc: PveEncounterStateResponse): Cell | null {
  const ev = [...enc.events].reverse().find((e) => e.eventType === "BOSS_MOVE_PLACED");
  return ev && ev.row != null && ev.col != null ? { row: ev.row, col: ev.col } : null;
}

/**
 * L8 SKILL_DEMON only (documents/PVE-全對弈階梯設計-2026-07-10.md §3/§9.2): the
 * cells affected by the boss's most recent skill cast this settlement, plus a
 * human-readable label — null if this settlement carried no boss skill cast.
 */
export function bossSkillCastFrom(
  enc: PveEncounterStateResponse
): { cells: Cell[]; skillType: SkillType } | null {
  const events = enc.bossSkillEvents ?? [];
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  return { cells: last.cells, skillType: last.skillType };
}
