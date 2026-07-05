import type { StoneColor } from "./GomokuBoard";
import type { BeachSide, FieldCell, RevealedCell } from "./GomokuBoard";
import { DIR_DELTA, wavePushDirection, type OceanSide } from "./duel";
import type {
  Cell,
  FieldEventItem,
  FieldState,
  GameReplayResponse,
  SkillDirection,
  SkillEvent,
} from "@/lib/types/schemas";

/**
 * Client-side replication of the serious-duel settlement — the API only
 * broadcasts event deltas (skillEvents / fieldEvents carry the ORIGIN cell
 * of each pushed stone, not its destination), so the UI re-derives board
 * mutations from the events plus the direction context it already knows:
 * slash direction from the submitted skill (or inferred from the move for
 * replays), wave direction from the ocean side.
 */

export type StoneMap = Record<string, StoneColor>;

export const cellKey = (row: number, col: number) => `${row},${col}`;

const flip = (c: StoneColor): StoneColor => (c === "black" ? "white" : "black");

/** UI flash groups produced while applying a settlement's events. */
export interface FlashGroup {
  cells: FieldCell[];
  type: "burn" | "tide" | "wave" | "slash";
}

export interface ApplyEventsCtx {
  /** direction of the actor's slash skill this settlement (if any) */
  slashDir?: SkillDirection | null;
  /** wave push direction (derived from the ocean side); beach only */
  waveDir?: SkillDirection | null;
  /** the acting player's stone color (STONE_REPLACED paints this color) */
  actor: StoneColor;
}

type AnyEvent = Pick<SkillEvent, "eventType" | "row" | "col">;

/**
 * Mutates `map` per the settlement events (in order) and returns the flash
 * groups for the board FX layer. STONE_PUSHED events before the WAVE_SURGED
 * marker are slash pushes (use ctx.slashDir); after it they are wave pushes
 * (use ctx.waveDir). The engine emits each push chain far-end first, so
 * sequential application never overwrites a stone.
 */
export function applyDuelEvents(
  map: StoneMap,
  events: AnyEvent[],
  ctx: ApplyEventsCtx,
): FlashGroup[] {
  let waveSeen = false;
  const groups: Record<FlashGroup["type"], FieldCell[]> = {
    burn: [],
    tide: [],
    wave: [],
    slash: [],
  };
  for (const e of events) {
    const { row, col } = e;
    switch (e.eventType) {
      case "WAVE_SURGED":
        waveSeen = true;
        break;
      case "STONE_PUSHED": {
        if (row == null || col == null) break;
        const dir = waveSeen ? ctx.waveDir : ctx.slashDir;
        if (!dir) break; // no direction context: leave the stone (best effort)
        const { dr, dc } = DIR_DELTA[dir];
        const color = map[cellKey(row, col)];
        if (!color) break;
        delete map[cellKey(row, col)];
        map[cellKey(row + dr, col + dc)] = color;
        groups[waveSeen ? "wave" : "slash"].push({ row: row + dr, col: col + dc });
        break;
      }
      case "STONE_REMOVED_OFF_BOARD":
        if (row == null || col == null) break;
        delete map[cellKey(row, col)];
        groups[waveSeen ? "wave" : "slash"].push({ row, col });
        break;
      case "STONES_BURNED":
        if (row == null || col == null) break;
        delete map[cellKey(row, col)];
        groups.burn.push({ row, col });
        break;
      case "STONES_CLEARED":
        if (row == null || col == null) break;
        delete map[cellKey(row, col)];
        groups.slash.push({ row, col });
        break;
      case "COLORS_SWAPPED": {
        if (row == null || col == null) break;
        const cur = map[cellKey(row, col)];
        if (cur) map[cellKey(row, col)] = flip(cur);
        groups.slash.push({ row, col });
        break;
      }
      case "STONE_REPLACED":
        if (row == null || col == null) break;
        map[cellKey(row, col)] = ctx.actor;
        groups.slash.push({ row, col });
        break;
      case "VOLCANO_ERUPTED":
        if (row == null || col == null) break;
        groups.burn.push({ row, col });
        break;
      case "TIDE_TRIGGERED":
        if (row == null || col == null) break;
        groups.tide.push({ row, col });
        break;
      // FIELD_GENERATED / TIDE_RISEN / SAND_ERODED do not move stones here;
      // erosion is applied via erodedRows (fieldState / SAND_ERODED count).
      default:
        break;
    }
  }
  return (Object.keys(groups) as FlashGroup["type"][])
    .filter((t) => groups[t].length > 0)
    .map((t) => ({ type: t, cells: groups[t] }));
}

export const stonesFromMap = (map: StoneMap) =>
  Object.entries(map).map(([k, color]) => {
    const [r, c] = k.split(",").map(Number);
    return { r, c, color };
  });

// ── Field metadata from the replay timeline ─────────────────────

export interface DuelFieldMeta {
  obstacles: Cell[];
  oceanSide: OceanSide | null;
}

export type SeaSide = NonNullable<FieldState["seaSide"]>;

/** api.yml's compass-facing seaSide (NORTH/SOUTH/EAST/WEST, 需求 #40) maps
 * 1:1 onto the board-relative OceanSide (UP/DOWN/LEFT/RIGHT) used to drive
 * wave-push direction and rendering. */
export const SEA_SIDE_TO_OCEAN_SIDE: Record<SeaSide, OceanSide> = {
  NORTH: "UP",
  SOUTH: "DOWN",
  EAST: "RIGHT",
  WEST: "LEFT",
};
export const OCEAN_SIDE_TO_SEA_SIDE: Record<OceanSide, SeaSide> = {
  UP: "NORTH",
  DOWN: "SOUTH",
  RIGHT: "EAST",
  LEFT: "WEST",
};

/**
 * Mock/back-end convention: VOLCANO emits one FIELD_GENERATED per obstacle
 * (with its coordinates); BEACH emits a single FIELD_GENERATED whose cell
 * sits on the centre of the ocean edge. api.yml's fieldState now carries
 * seaSide directly (需求 #40) — prefer that when present, and fall back to
 * inferring the side from which edge the FIELD_GENERATED cell sits on only
 * when seaSide is absent (e.g. GameReplayResponse callers that don't carry
 * fieldState).
 */
export function duelFieldMeta(
  events: FieldEventItem[] | undefined,
  fieldType: "VOLCANO" | "BEACH",
  size: number,
  seaSide?: FieldState["seaSide"],
): DuelFieldMeta {
  const gen = (events ?? []).filter((e) => e.eventType === "FIELD_GENERATED");
  if (fieldType === "VOLCANO") {
    return {
      obstacles: gen
        .filter((e) => e.row != null && e.col != null)
        .map((e) => ({ row: e.row!, col: e.col! })),
      oceanSide: null,
    };
  }
  if (seaSide) return { obstacles: [], oceanSide: SEA_SIDE_TO_OCEAN_SIDE[seaSide] };
  const hint = gen.find((e) => e.row != null && e.col != null);
  let side: OceanSide = "UP"; // sensible default when no hint is present
  if (hint) {
    if (hint.row === 0) side = "UP";
    else if (hint.row === size - 1) side = "DOWN";
    else if (hint.col === 0) side = "LEFT";
    else side = "RIGHT";
  }
  return { obstacles: [], oceanSide: side };
}

export const beachSideFor = (side: OceanSide): BeachSide =>
  side === "UP" ? "top" : side === "DOWN" ? "bottom" : side === "LEFT" ? "left" : "right";

/**
 * Slash direction inference for replays (FieldEventItem has no direction):
 * slash targets are exactly the row/col adjacent to the placed stone in the
 * slash direction, so the first slash-push origin's offset from the move
 * reveals the direction.
 */
export function inferSlashDir(move: Cell, pushed: Cell): SkillDirection | null {
  if (pushed.row === move.row - 1) return "UP";
  if (pushed.row === move.row + 1) return "DOWN";
  if (pushed.col === move.col - 1) return "LEFT";
  if (pushed.col === move.col + 1) return "RIGHT";
  return null;
}

// ── Replay timeline reconstruction (需求 #47) ────────────────────

export interface DuelStep {
  moveNumber: number;
  /** stone placed this step; null for settle-only steps (ultimates, step 0) */
  move: { r: number; c: number; color: StoneColor } | null;
  stones: { r: number; c: number; color: StoneColor }[];
  revealed: RevealedCell[];
  erodedRows: number;
  tideTriggered: boolean;
  /** event types settled at this step (for the step caption) */
  eventTypes: string[];
}

/**
 * Rebuild the board after every action of a serious-duel replay by walking
 * the union of move numbers and event move-numbers in order (ultimates
 * consume a turn without appearing in `moves`, so their settlement events
 * carry a move number of their own). Index 0 = empty board (field
 * generated), index i = board after action i. Scatter second stones are a
 * known mock replay limitation (not present in `moves`).
 */
export function duelSnapshots(replay: GameReplayResponse): DuelStep[] {
  const fieldType = replay.fieldType ?? "VOLCANO";
  const size = fieldType === "BEACH" ? 16 : 15;
  const meta = duelFieldMeta(replay.fieldEvents, fieldType, size);
  const waveDir = meta.oceanSide ? wavePushDirection(meta.oceanSide) : null;
  const moveAt = new Map(replay.moves.map((m) => [m.moveNumber, m]));
  const byMove = new Map<number, FieldEventItem[]>();
  for (const e of replay.fieldEvents ?? []) {
    // moveNumber is null for FIELD_GENERATED (happens at build time, before
    // any move — real backend sends null; erm.dbml field_events.move_number
    // is nullable for exactly this reason). Group it under step 0 alongside
    // the initial empty-board snapshot; every other event type always has a
    // concrete moveNumber.
    const n = e.moveNumber ?? 0;
    const list = byMove.get(n) ?? [];
    list.push(e);
    byMove.set(n, list);
  }
  const numberSet = new Set<number>();
  moveAt.forEach((_, n) => n > 0 && numberSet.add(n));
  byMove.forEach((_, n) => n > 0 && numberSet.add(n));
  const numbers = Array.from(numberSet).sort((a, b) => a - b);

  const map: StoneMap = {};
  const revealed: RevealedCell[] = [];
  let erodedRows = 0;
  const steps: DuelStep[] = [];

  const settle = (
    moveNumber: number,
    mover: { color: StoneColor; cell: Cell } | null,
    actor: StoneColor,
  ) => {
    const events = byMove.get(moveNumber) ?? [];
    // reveals accumulate; kind follows the event type (beach → TIDE 🌊,
    // volcano → ERUPTION 🌋 — the prototype's hardcoded 'eruption' fixed)
    for (const e of events) {
      if (e.eventType === "VOLCANO_ERUPTED" && e.row != null && e.col != null)
        revealed.push({ row: e.row, col: e.col, kind: "ERUPTION" });
      if (e.eventType === "TIDE_TRIGGERED" && e.row != null && e.col != null)
        revealed.push({ row: e.row, col: e.col, kind: "TIDE" });
      if (e.eventType === "SAND_ERODED") erodedRows += 1;
    }
    // slash dir: first pre-wave STONE_PUSHED origin vs the move's cell
    let slashDir: SkillDirection | null = null;
    if (mover) {
      for (const e of events) {
        if (e.eventType === "WAVE_SURGED") break;
        if (e.eventType === "STONE_PUSHED" && e.row != null && e.col != null) {
          slashDir = inferSlashDir(mover.cell, { row: e.row, col: e.col });
          break;
        }
      }
    }
    applyDuelEvents(map, events, { slashDir, waveDir, actor });
    steps.push({
      moveNumber,
      move: mover ? { r: mover.cell.row, c: mover.cell.col, color: mover.color } : null,
      stones: stonesFromMap(map),
      revealed: [...revealed],
      erodedRows,
      tideTriggered: revealed.some((r) => r.kind === "TIDE"),
      eventTypes: events.map((e) => e.eventType),
    });
  };

  settle(0, null, "black"); // FIELD_GENERATED step
  for (const n of numbers) {
    // BLACK always acts first in duel games, so odd action numbers are black
    const actor: StoneColor = n % 2 === 1 ? "black" : "white";
    const m = moveAt.get(n);
    if (m) {
      const color: StoneColor = m.color === "BLACK" ? "black" : "white";
      const events = byMove.get(n) ?? [];
      const replaced = events.some((e) => e.eventType === "STONE_REPLACED");
      // STONE_REPLACED repaints via events; a plain move places a stone first
      if (!replaced) map[cellKey(m.row, m.col)] = color;
      settle(n, { color, cell: { row: m.row, col: m.col } }, color);
    } else {
      settle(n, null, actor); // ultimate: settlement without a placed stone
    }
  }
  return steps;
}
