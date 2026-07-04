import { key, checkWin, type Board } from "./winCheck";
import type {
  Cell,
  Color,
  ClassType,
  FieldType,
  SkillDirection,
  SkillType,
} from "@/lib/types/schemas";

/**
 * Serious-duel (真劍勝負) pure game logic — shared by the MSW mock engine and
 * (next phase) the UI for previews. No I/O, no randomness: callers inject
 * RNG-derived data (obstacles, hidden cells, ocean side).
 *
 * Rule authority: documents/clarify/2026-07-04-1021.md (Q1–Q10, R2).
 */

// ── Geometry basics ─────────────────────────────────────────────
export const BOARD_SIZE: Record<FieldType, number> = {
  VOLCANO: 15, // 需求 #39
  BEACH: 16, // Q6: beach (and only beach) plays on 16x16
};

export const boardSize = (fieldType: FieldType) => BOARD_SIZE[fieldType];

export const DIR_DELTA: Record<SkillDirection, { dr: number; dc: number }> = {
  UP: { dr: -1, dc: 0 },
  DOWN: { dr: 1, dc: 0 },
  LEFT: { dr: 0, dc: -1 },
  RIGHT: { dr: 0, dc: 1 },
};

export const inBoard = (row: number, col: number, size: number) =>
  row >= 0 && row < size && col >= 0 && col < size;

export const chebyshev = (a: Cell, b: Cell) =>
  Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));

/** The 8 in-board neighbours of a cell (volcano eruption burn radius, Q5). */
export function neighbors8(cell: Cell, size: number): Cell[] {
  const out: Cell[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const row = cell.row + dr;
      const col = cell.col + dc;
      if (inBoard(row, col, size)) out.push({ row, col });
    }
  }
  return out;
}

// ── Class kits (Q1) ─────────────────────────────────────────────
export const CLASS_SKILLS: Record<ClassType, SkillType[]> = {
  WARRIOR: ["HORIZONTAL_SLASH", "VERTICAL_SLASH", "HEAVEN_EARTH_REVERSAL"],
  ARCHER: ["PRECISION_SNIPE", "SCATTER_SHOT", "PIONEER_STAR"],
};

export const ULTIMATE_SKILLS: SkillType[] = ["HEAVEN_EARTH_REVERSAL", "PIONEER_STAR"];

export const isUltimate = (skill: SkillType) => ULTIMATE_SKILLS.includes(skill);

// ── Ultimate rectangle geometry (Q4) ────────────────────────────
/**
 * Anchor (must be an empty cell) + facing direction → 3-wide x 2-deep
 * rectangle: anchor (mid-1), the cell behind it in `dir` (mid-2), and the
 * two flanking columns at depth 2 each — 6 cells; out-of-board cells are
 * dropped. Shared by HEAVEN_EARTH_REVERSAL / PIONEER_STAR and UI previews.
 */
export function ultimateRect(anchor: Cell, dir: SkillDirection, size: number): Cell[] {
  const d = DIR_DELTA[dir];
  // perpendicular axis: flanks sit left/right of the facing direction
  const perp = d.dr !== 0 ? { dr: 0, dc: 1 } : { dr: 1, dc: 0 };
  const cells: Cell[] = [];
  for (let depth = 0; depth <= 1; depth++) {
    for (let side = -1; side <= 1; side++) {
      const row = anchor.row + d.dr * depth + perp.dr * side;
      const col = anchor.col + d.dc * depth + perp.dc * side;
      if (inBoard(row, col, size)) cells.push({ row, col });
    }
  }
  return cells;
}

// ── Slash target cells (Q10) ────────────────────────────────────
/**
 * HORIZONTAL_SLASH (dir UP/DOWN): the 3 cells of the adjacent row in `dir`
 * (front + front-left + front-right of the just-placed stone), each pushed
 * 1 step in `dir`. VERTICAL_SLASH (dir LEFT/RIGHT): symmetric on columns.
 * Out-of-board cells are dropped.
 */
export function slashCells(
  stone: Cell,
  skillType: "HORIZONTAL_SLASH" | "VERTICAL_SLASH",
  dir: SkillDirection,
  size: number,
): Cell[] {
  const d = DIR_DELTA[dir];
  const cells: Cell[] = [];
  if (skillType === "HORIZONTAL_SLASH") {
    const row = stone.row + d.dr;
    for (let col = stone.col - 1; col <= stone.col + 1; col++) {
      if (inBoard(row, col, size)) cells.push({ row, col });
    }
  } else {
    const col = stone.col + d.dc;
    for (let row = stone.row - 1; row <= stone.row + 1; row++) {
      if (inBoard(row, col, size)) cells.push({ row, col });
    }
  }
  return cells;
}

// ── Push resolver (Q3, shared by slashes and waves) ─────────────
export interface PushEvent {
  eventType: "STONE_PUSHED" | "STONE_REMOVED_OFF_BOARD";
  /** original cell of the affected stone */
  row: number;
  col: number;
}

/**
 * Push each source cell's stone 1 step in `dir`. If the destination holds a
 * stone the whole contiguous column chains; a stone shoved past the edge is
 * removed (STONE_REMOVED_OFF_BOARD); if the chain runs into a blocked cell
 * (volcano obstacle) the entire column stays put. Mutates `board`; returns
 * the events in resolution order.
 */
export function resolvePush(
  board: Board,
  sources: Cell[],
  dir: SkillDirection,
  size: number,
  isBlocked: (row: number, col: number) => boolean = () => false,
): PushEvent[] {
  const { dr, dc } = DIR_DELTA[dir];
  // Process front-most sources first so stones sharing a column are each
  // pushed exactly once (a source freed by an earlier chain still moves 1).
  const sorted = [...sources].sort(
    (a, b) => (b.row * dr + b.col * dc) - (a.row * dr + a.col * dc),
  );
  const events: PushEvent[] = [];
  for (const src of sorted) {
    if (!board[key(src.row, src.col)]) continue; // empty source: nothing to push
    // contiguous chain of stones starting at the source, along dir
    const chain: Cell[] = [];
    let r = src.row;
    let c = src.col;
    while (inBoard(r, c, size) && board[key(r, c)]) {
      chain.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    // (r,c) is the first cell past the chain
    if (inBoard(r, c, size) && isBlocked(r, c)) continue; // obstacle: column frozen
    const offBoard = !inBoard(r, c, size);
    for (let i = chain.length - 1; i >= 0; i--) {
      const cur = chain[i];
      const color = board[key(cur.row, cur.col)];
      delete board[key(cur.row, cur.col)];
      if (i === chain.length - 1 && offBoard) {
        events.push({ eventType: "STONE_REMOVED_OFF_BOARD", row: cur.row, col: cur.col });
      } else {
        board[key(cur.row + dr, cur.col + dc)] = color;
        events.push({ eventType: "STONE_PUSHED", row: cur.row, col: cur.col });
      }
    }
  }
  return events;
}

// ── Beach geometry (Q6/Q7) ──────────────────────────────────────
/** Which side of the board the ocean occupies. */
export type OceanSide = SkillDirection;

/** Ocean depth in rows/cols: half the board + eroded rows (Q6). */
export const oceanDepth = (size: number, erodedRows: number) => size / 2 + erodedRows;

export function isOcean(
  cell: Cell,
  side: OceanSide,
  erodedRows: number,
  size: number,
): boolean {
  const depth = oceanDepth(size, erodedRows);
  switch (side) {
    case "UP":
      return cell.row < depth;
    case "DOWN":
      return cell.row >= size - depth;
    case "LEFT":
      return cell.col < depth;
    case "RIGHT":
      return cell.col >= size - depth;
  }
}

/** Waves push ocean stones toward the beach — opposite of the ocean side. */
export function wavePushDirection(side: OceanSide): SkillDirection {
  switch (side) {
    case "UP":
      return "DOWN";
    case "DOWN":
      return "UP";
    case "LEFT":
      return "RIGHT";
    case "RIGHT":
      return "LEFT";
  }
}

/**
 * Row (or column) index of the beach line eroded when erodedRows goes from
 * `erodedRows` to `erodedRows + 1` — the beach row closest to the ocean.
 */
export function nextErodedLineIndex(side: OceanSide, erodedRows: number, size: number): number {
  const depth = oceanDepth(size, erodedRows); // current ocean depth
  switch (side) {
    case "UP":
    case "LEFT":
      return depth; // first line past the ocean
    case "DOWN":
    case "RIGHT":
      return size - depth - 1;
  }
}

// ── Whole-board win scan (Q2: single settlement-end check) ──────
/**
 * After settlement stones may have moved or vanished, so the win check must
 * scan the final board for both colors. Returns each color's line (if any);
 * the caller resolves simultaneous fives in favour of the acting player.
 */
export function scanBoardWin(
  board: Board,
  size: number,
): { BLACK: Cell[] | null; WHITE: Cell[] | null } {
  const result: { BLACK: Cell[] | null; WHITE: Cell[] | null } = {
    BLACK: null,
    WHITE: null,
  };
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const color = board[key(row, col)] as Color | undefined;
      if (!color || result[color]) continue;
      const line = checkWin(board, row, col, color);
      if (line) result[color] = line;
    }
  }
  return result;
}
