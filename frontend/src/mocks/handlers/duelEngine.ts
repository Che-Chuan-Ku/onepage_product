import { key, type Board } from "@/lib/game/winCheck";
import {
  BOARD_SIZE,
  CLASS_SKILLS,
  chebyshev,
  inBoard,
  isOcean,
  isUltimate,
  neighbors8,
  nextErodedLineIndex,
  oceanDepth,
  resolvePush,
  scanBoardWin,
  slashCells,
  ultimateRect,
  wavePushDirection,
  type OceanSide,
} from "@/lib/game/duel";
import { OCEAN_SIDE_TO_SEA_SIDE } from "@/lib/game/duelClient";
import type {
  Cell,
  ClassType,
  Color,
  FieldEventItem,
  FieldType,
  GameResult,
  GameStatus,
  MoveCreateRequest,
  RevealedHiddenCell,
  SkillEvent,
} from "@/lib/types/schemas";

/**
 * MSW serious-duel game engine — server-authoritative simulation of a duel
 * match so the UI (next phase) and e2e can run without a backend.
 *
 * Settlement order per turn (Q2: single win check at the very end):
 *   1. request validation  2. stone placement (incl. snipe replace / scatter)
 *   3. hidden-cell triggers on placed cells (eruption burn / tide arm)
 *   4. skill resolution (slash pushes / ultimate swap or clear)
 *   5. wave surge if due (beach, every 10 half-moves; erosion if tide armed)
 *   6. one win/draw check on the final board (actor wins simultaneous fives)
 */

export interface DuelGame {
  gameId: string;
  gameMode: "LOCAL" | "ONLINE";
  battleMode: "SERIOUS_DUEL";
  fieldType: FieldType;
  status: GameStatus;
  currentTurn: Color | null;
  board: Board;
  moveCount: number;
  blackClass: ClassType;
  whiteClass: ClassType;
  obstacles: Cell[]; // volcano, public
  hiddenEruptions: Cell[]; // volcano, never serialized until triggered
  hiddenTides: Cell[]; // beach, never serialized until triggered
  oceanSide: OceanSide; // beach
  erodedRows: number;
  tideTriggered: boolean;
  usedSkills: Record<Color, string[]>;
  lastMove: { color: Color; row: number; col: number } | null;
  result: GameResult | null;
  winningLine: Cell[] | null;
  /** events of the latest settlement only (GameStateResponse.skillEvents) */
  lastEvents: SkillEvent[];
  /** hidden cells revealed by the latest settlement */
  lastRevealed: RevealedHiddenCell[];
  /** full event timeline for replay (需求 #47) */
  fieldEvents: FieldEventItem[];
  moves: { moveNumber: number; color: Color; row: number; col: number }[];
}

export const duelGames = new Map<string, DuelGame>();

export type DuelMoveResult =
  | { ok: true; game: DuelGame }
  | { ok: false; httpStatus: number; code: string; message: string };

const reject = (code: string, message: string): DuelMoveResult => ({
  ok: false,
  httpStatus: 422,
  code,
  message,
});

// ── Seeded RNG (deterministic hidden cells for e2e) ─────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickCells(
  rng: () => number,
  size: number,
  count: number,
  taken: Set<string>,
): Cell[] {
  const out: Cell[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 10_000) {
    const row = Math.floor(rng() * size);
    const col = Math.floor(rng() * size);
    const k = key(row, col);
    if (taken.has(k)) continue;
    taken.add(k);
    out.push({ row, col });
  }
  return out;
}

// ── Game creation ───────────────────────────────────────────────
export function createDuelGame(opts: {
  gameId: string;
  fieldType: FieldType;
  blackClass: ClassType;
  whiteClass: ClassType;
  gameMode?: "LOCAL" | "ONLINE";
  seed?: number;
}): DuelGame {
  const { gameId, fieldType, blackClass, whiteClass } = opts;
  const size = BOARD_SIZE[fieldType];
  const rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 2 ** 31));
  const taken = new Set<string>();

  let obstacles: Cell[] = [];
  let hiddenEruptions: Cell[] = [];
  let hiddenTides: Cell[] = [];
  const sides: OceanSide[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  let oceanSide: OceanSide = "UP";
  if (fieldType === "VOLCANO") {
    // Q5: 5–8 public obstacles, up to 5 hidden one-shot eruption cells
    obstacles = pickCells(rng, size, 5 + Math.floor(rng() * 4), taken);
    hiddenEruptions = pickCells(rng, size, 5, taken);
  } else {
    // Q6: ocean occupies a random side; Q7: up to 5 hidden tide cells
    oceanSide = sides[Math.floor(rng() * sides.length)];
    hiddenTides = pickCells(rng, size, 5, taken);
  }

  // Beach FIELD_GENERATED carries the ocean-edge centre cell as a mock
  // convention (kept for replay callers, which have no fieldState): the UI
  // can infer the side from which edge this coordinate sits on. The live
  // fieldState response below also carries seaSide directly (api.yml:1057-
  // 1061, 需求 #40), which callers should prefer over this heuristic.
  const mid = Math.floor(size / 2);
  const oceanHint: Record<OceanSide, Cell> = {
    UP: { row: 0, col: mid },
    DOWN: { row: size - 1, col: mid },
    LEFT: { row: mid, col: 0 },
    RIGHT: { row: mid, col: size - 1 },
  };
  const genEvents: SkillEvent[] =
    fieldType === "VOLCANO"
      ? obstacles.map((o) => ({
          eventType: "FIELD_GENERATED" as const,
          row: o.row,
          col: o.col,
          effectTriggered: true,
        }))
      : [
          {
            eventType: "FIELD_GENERATED" as const,
            row: oceanHint[oceanSide].row,
            col: oceanHint[oceanSide].col,
            effectTriggered: true,
          },
        ];

  const g: DuelGame = {
    gameId,
    gameMode: opts.gameMode ?? "LOCAL",
    battleMode: "SERIOUS_DUEL",
    fieldType,
    status: "PLAYING", // classes reveal at game start (Q8)
    currentTurn: "BLACK",
    board: {},
    moveCount: 0,
    blackClass,
    whiteClass,
    obstacles,
    hiddenEruptions,
    hiddenTides,
    oceanSide,
    erodedRows: 0,
    tideTriggered: false,
    usedSkills: { BLACK: [], WHITE: [] },
    lastMove: null,
    result: null,
    winningLine: null,
    lastEvents: genEvents,
    lastRevealed: [],
    fieldEvents: genEvents.map((e) => ({
      moveNumber: 0,
      eventType: e.eventType,
      row: e.row,
      col: e.col,
    })),
    moves: [],
  };
  duelGames.set(gameId, g);
  return g;
}

/** Pre-seeded PLAYING demo games (LOCAL: one browser drives both sides). */
export function ensureDemoDuelGames() {
  if (!duelGames.has("duel-volcano-demo")) {
    createDuelGame({
      gameId: "duel-volcano-demo",
      fieldType: "VOLCANO",
      blackClass: "WARRIOR",
      whiteClass: "ARCHER",
      gameMode: "LOCAL",
      seed: 42,
    });
  }
  if (!duelGames.has("duel-beach-demo")) {
    createDuelGame({
      gameId: "duel-beach-demo",
      fieldType: "BEACH",
      blackClass: "ARCHER",
      whiteClass: "WARRIOR",
      gameMode: "LOCAL",
      seed: 7,
    });
  }
}

// ── Move application ────────────────────────────────────────────
export function applyDuelMove(g: DuelGame, body: MoveCreateRequest): DuelMoveResult {
  if (g.status !== "PLAYING" || g.currentTurn == null)
    return reject("422003", "目前無法落子");

  const size = BOARD_SIZE[g.fieldType];
  const actor = g.currentTurn;
  const actorClass = actor === "BLACK" ? g.blackClass : g.whiteClass;
  const obstacleSet = new Set(g.obstacles.map((o) => key(o.row, o.col)));
  const isBlocked = (row: number, col: number) => obstacleSet.has(key(row, col));

  const events: SkillEvent[] = [];
  const revealed: RevealedHiddenCell[] = [];
  const push = (
    eventType: SkillEvent["eventType"],
    row: number | null,
    col: number | null,
  ) => events.push({ eventType, row, col, effectTriggered: true });

  const skill = "skill" in body ? body.skill : undefined;
  if (skill) {
    if (!CLASS_SKILLS[actorClass].includes(skill.skillType))
      return reject("422004", "該職業沒有此技能");
    if (g.usedSkills[actor].includes(skill.skillType))
      return reject("422005", "此技能本場已使用過");
  }

  const isUltimateMove = !("row" in body);
  const placedCells: Cell[] = [];

  if (isUltimateMove) {
    // ── Ultimate: replaces this turn's stone (Q1/Q4) ──
    const ult = body.skill;
    const { anchor, direction } = ult;
    if (!direction) return reject("422006", "大絕需指定方向");
    if (!inBoard(anchor.row, anchor.col, size))
      return reject("422001", "錨點超出棋盤");
    if (g.board[key(anchor.row, anchor.col)] || isBlocked(anchor.row, anchor.col))
      return reject("422006", "大絕錨點必須是空格");
    const rect = ultimateRect(anchor, direction, size);
    if (ult.skillType === "HEAVEN_EARTH_REVERSAL") {
      for (const cell of rect) {
        const k = key(cell.row, cell.col);
        const color = g.board[k];
        if (!color) continue;
        g.board[k] = color === "BLACK" ? "WHITE" : "BLACK";
        push("COLORS_SWAPPED", cell.row, cell.col);
      }
    } else {
      for (const cell of rect) {
        const k = key(cell.row, cell.col);
        if (!g.board[k]) continue;
        delete g.board[k];
        push("STONES_CLEARED", cell.row, cell.col);
      }
    }
    g.usedSkills[actor].push(ult.skillType);
  } else {
    // ── Normal placement (optionally with a regular skill) ──
    if (skill && isUltimate(skill.skillType))
      return reject("422006", "大絕不可附帶落子座標");
    const { row, col } = body;
    if (!inBoard(row, col, size)) return reject("422001", "落子位置超出棋盤");
    if (isBlocked(row, col)) return reject("422002", "該格為障礙物，禁止落子");

    if (skill?.skillType === "PRECISION_SNIPE") {
      // Q10: replace one existing enemy stone — that replacement IS the move
      const target = skill.target;
      if (!target || target.row !== row || target.col !== col)
        return reject("422006", "精準狙擊的 row/col 須等於 target");
      const existing = g.board[key(row, col)];
      const enemy: Color = actor === "BLACK" ? "WHITE" : "BLACK";
      if (existing !== enemy)
        return reject("422006", "精準狙擊目標必須是現存敵方棋子");
      g.board[key(row, col)] = actor;
      push("STONE_REPLACED", row, col);
      // replaced cell held a stone before, so it cannot be an untriggered
      // hidden cell — no placement-trigger check needed
    } else if (skill?.skillType === "SCATTER_SHOT") {
      const second = skill.secondStone;
      if (!second) return reject("422006", "散射需要 secondStone");
      if (!inBoard(second.row, second.col, size))
        return reject("422001", "散射第二子超出棋盤");
      if (chebyshev({ row, col }, second) < 2)
        return reject("422006", "散射兩子的 Chebyshev 距離須 >= 2");
      if (g.board[key(row, col)] || g.board[key(second.row, second.col)])
        return reject("422002", "該位置已有棋子");
      if (isBlocked(second.row, second.col))
        return reject("422002", "該格為障礙物，禁止落子");
      g.board[key(row, col)] = actor;
      g.board[key(second.row, second.col)] = actor;
      placedCells.push({ row, col }, second);
    } else {
      if (skill?.skillType === "HORIZONTAL_SLASH" && skill.direction !== "UP" && skill.direction !== "DOWN")
        return reject("422006", "橫劈方向須為 UP/DOWN");
      if (skill?.skillType === "VERTICAL_SLASH" && skill.direction !== "LEFT" && skill.direction !== "RIGHT")
        return reject("422006", "縱劈方向須為 LEFT/RIGHT");
      if (g.board[key(row, col)]) return reject("422002", "該位置已有棋子");
      g.board[key(row, col)] = actor;
      placedCells.push({ row, col });
    }
    g.lastMove = { color: actor, row, col };

    // ── Hidden-cell triggers on freshly placed cells ──
    for (const cell of placedCells) {
      if (g.fieldType === "VOLCANO") {
        const hit = g.hiddenEruptions.findIndex(
          (h) => h.row === cell.row && h.col === cell.col,
        );
        if (hit >= 0) {
          g.hiddenEruptions.splice(hit, 1); // one-shot: becomes a normal cell
          revealed.push({ cellKind: "ERUPTION", row: cell.row, col: cell.col });
          push("VOLCANO_ERUPTED", cell.row, cell.col);
          // burn the 8 neighbours; the triggering stone itself survives (Q5)
          for (const n of neighbors8(cell, size)) {
            if (g.board[key(n.row, n.col)]) {
              delete g.board[key(n.row, n.col)];
              push("STONES_BURNED", n.row, n.col);
            }
          }
        }
      } else {
        const hit = g.hiddenTides.findIndex(
          (h) => h.row === cell.row && h.col === cell.col,
        );
        if (hit >= 0) {
          g.hiddenTides.splice(hit, 1);
          revealed.push({ cellKind: "TIDE", row: cell.row, col: cell.col });
          push("TIDE_TRIGGERED", cell.row, cell.col);
          g.tideTriggered = true;
        }
      }
    }

    // ── Slash resolution (after eruption per settlement order) ──
    if (skill?.skillType === "HORIZONTAL_SLASH" || skill?.skillType === "VERTICAL_SLASH") {
      const dir = skill.direction!;
      const targets = slashCells({ row, col }, skill.skillType, dir, size);
      for (const e of resolvePush(g.board, targets, dir, size, isBlocked)) {
        push(e.eventType, e.row, e.col);
      }
    }
    if (skill) g.usedSkills[actor].push(skill.skillType);
  }

  g.moveCount += 1;
  if (!isUltimateMove && "row" in body) {
    g.moves.push({ moveNumber: g.moveCount, color: actor, row: body.row, col: body.col });
  }

  // ── Wave surge: beach, every 5 rounds = 10 half-moves (Q6/Q7) ──
  if (g.fieldType === "BEACH" && g.moveCount > 0 && g.moveCount % 10 === 0) {
    push("WAVE_SURGED", null, null);
    const oceanStones: Cell[] = [];
    for (const k of Object.keys(g.board)) {
      const [r, c] = k.split(",").map(Number);
      if (isOcean({ row: r, col: c }, g.oceanSide, g.erodedRows, size))
        oceanStones.push({ row: r, col: c });
    }
    const dir = wavePushDirection(g.oceanSide);
    for (const e of resolvePush(g.board, oceanStones, dir, size)) {
      push(e.eventType, e.row, e.col);
    }
    // Erosion advances on the wave after the tide is armed; eroded stones
    // stay and count as ocean stones from the next wave on (Q7).
    if (g.tideTriggered && oceanDepth(size, g.erodedRows) < size) {
      const line = nextErodedLineIndex(g.oceanSide, g.erodedRows, size);
      g.erodedRows += 1;
      const horizontal = g.oceanSide === "UP" || g.oceanSide === "DOWN";
      push("TIDE_RISEN", horizontal ? line : null, horizontal ? null : line);
      push("SAND_ERODED", horizontal ? line : null, horizontal ? null : line);
    }
  }

  // ── Single win/draw check on the final board (Q2) ──
  const lines = scanBoardWin(g.board, size);
  const enemy: Color = actor === "BLACK" ? "WHITE" : "BLACK";
  if (lines[actor]) {
    g.status = "FINISHED";
    g.result = actor === "BLACK" ? "BLACK_WIN" : "WHITE_WIN";
    g.winningLine = lines[actor];
    g.currentTurn = null;
  } else if (lines[enemy]) {
    g.status = "FINISHED";
    g.result = enemy === "BLACK" ? "BLACK_WIN" : "WHITE_WIN";
    g.winningLine = lines[enemy];
    g.currentTurn = null;
  } else if (g.moveCount >= size * size) {
    g.status = "FINISHED";
    g.result = "DRAW";
    g.currentTurn = null;
  } else {
    g.currentTurn = enemy;
  }

  g.lastEvents = events;
  g.lastRevealed = revealed;
  for (const e of events) {
    g.fieldEvents.push({
      moveNumber: g.moveCount,
      eventType: e.eventType,
      row: e.row,
      col: e.col,
    });
  }
  return { ok: true, game: g };
}

// ── Serializers (api.yml response shapes) ───────────────────────
export function duelGameState(g: DuelGame) {
  // Final state of a finished game additionally reveals every untriggered
  // hidden cell (end-of-game full disclosure for the result screen).
  const revealed = [...g.lastRevealed];
  if (g.status === "FINISHED") {
    for (const h of g.hiddenEruptions)
      revealed.push({ cellKind: "ERUPTION", row: h.row, col: h.col });
    for (const h of g.hiddenTides)
      revealed.push({ cellKind: "TIDE", row: h.row, col: h.col });
  }
  return {
    gameId: g.gameId,
    status: g.status,
    currentTurn: g.currentTurn,
    moveCount: g.moveCount,
    lastMove: g.lastMove,
    result: g.result,
    winningLine: g.winningLine,
    blackClass: g.status === "PLAYING" || g.status === "FINISHED" ? g.blackClass : null,
    whiteClass: g.status === "PLAYING" || g.status === "FINISHED" ? g.whiteClass : null,
    fieldState: {
      fieldType: g.fieldType,
      obstacles: g.obstacles,
      // BEACH only (需求 #40); VOLCANO has no ocean side.
      seaSide: g.fieldType === "BEACH" ? OCEAN_SIDE_TO_SEA_SIDE[g.oceanSide] : null,
      erodedRows: g.erodedRows,
      tideTriggered: g.tideTriggered,
      roundCounter: Math.floor(g.moveCount / 2),
    },
    revealedHiddenCells: revealed,
    skillEvents: g.lastEvents,
  };
}

export function duelGameDetail(g: DuelGame) {
  return {
    gameId: g.gameId,
    gameMode: g.gameMode,
    useSwap2: false, // duel is mutually exclusive with Swap2 (Q9)
    battleMode: g.battleMode,
    fieldType: g.fieldType,
    status: g.status,
    currentTurn: g.currentTurn,
  };
}

export function duelGameReplay(g: DuelGame) {
  return {
    gameId: g.gameId,
    result: g.result,
    winnerPlayerId: null,
    moveCount: g.moveCount,
    useSwap2: false,
    battleMode: g.battleMode,
    fieldType: g.fieldType,
    blackClass: g.blackClass,
    whiteClass: g.whiteClass,
    fieldEvents: g.fieldEvents,
    openingStones: [],
    moves: g.moves,
  };
}
