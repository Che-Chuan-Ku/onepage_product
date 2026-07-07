import type {
  ClassType,
  PveEncounterEvent,
  PveEncounterStateResponse,
  PveEncounterStatus,
  PveFieldType,
  PveLastResolution,
  PveLineDirection,
  PveLineResolution,
  PveMutationType,
  PveRunResultResponse,
  PveRunResultStatus,
  PveRunStateResponse,
  PveRunStatus,
  PveShopOfferItem,
  PveShopSkipResponse,
  PveShopStateResponse,
  PveShopStatus,
  PveSkillUseRequest,
  RelicType,
  SkillType,
} from "@/lib/types/schemas";
import {
  ALL_RELIC_TYPES,
  PVE_BOSS_HP_CURVE,
  PVE_CLASS_SKILL_POOL,
  PVE_CLEAR_GOLD_BASE,
  PVE_ERROR,
  PVE_FIXED_PLAIN_SEQUENCES,
  PVE_INITIAL_BOARD_COLS,
  PVE_INITIAL_BOARD_ROWS,
  PVE_INITIAL_GOLD,
  PVE_MOCK_PLAYER_ID,
  PVE_MOVE_BUDGET,
  PVE_MUTATION_BY_SEQUENCE,
  PVE_OTHER_PLAYER_ID,
  PVE_RELIC_HOLD_CAP,
  PVE_RELIC_SHOP_PRICE,
  PVE_SHOP_REROLL_COST,
  PVE_SKILL_HOLD_CAP,
  PVE_SKILL_SHOP_PRICE,
  PVE_STARTER_SKILL,
  PVE_VOLCANO_OBSTACLE_MAX,
  PVE_VOLCANO_OBSTACLE_MIN,
} from "../data/pveFixtures";

/**
 * MSW PVE 挑戰模式 mock engine — server-authoritative in-memory simulation,
 * mirroring the `duelEngine.ts` split (pure state/logic here; `handlers/
 * index.ts` only does http routing + Zod request validation).
 *
 * Scope note (documented simplification, consistent with the task's "mock
 * 不需要真的 AI 強度" allowance): PVE is solo player-vs-Boss — there is no
 * adversarial opponent placing stones (PveEncounterStateResponse.stones has
 * no `color` field; see pve-api-spec.md §2.3 疑義). Regular skills
 * (HORIZONTAL_SLASH/VERTICAL_SLASH/PRECISION_SNIPE/SCATTER_SHOT) are
 * bookkept fully (hold quantity, per-interval gating, CONSUMABLE decrement,
 * SKILL_USED event) but their board-geometry effects (push/replace/scatter)
 * are NOT simulated here — the response board is unchanged by a skill use.
 * Relic effects SHARP_BLADE / DIAGONAL_WALKER / METRONOME / RECYCLER /
 * GEMINI_STAR / VOLCANO_HEART (RAGE-burst only) are simulated; CHAIN_CORE
 * (skill push distance) and TIDE_BREAKWATER (beach wave/tide) have no
 * observable effect in this mock because their trigger mechanics aren't
 * modeled. Downstream page work can extend this file if deeper fidelity is
 * needed later.
 */

const cellKey = (r: number, c: number) => `${r},${c}`;
const parseCellKey = (k: string): { row: number; col: number } => {
  const [r, c] = k.split(",").map(Number);
  return { row: r, col: c };
};

function makeRng(seedStr: string): () => number {
  let state = 0;
  for (const ch of seedStr) state = (state * 31 + ch.charCodeAt(0)) | 0;
  if (state === 0) state = 1;
  return () => {
    state ^= state << 13;
    state |= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state |= 0;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function pickN<T>(pool: T[], n: number, rng: () => number): T[] {
  const copy = [...pool];
  const picked: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    picked.push(copy.splice(idx, 1)[0]);
  }
  return picked;
}

const PVE_LINE_DIRECTIONS: [number, number, PveLineDirection][] = [
  [0, 1, "HORIZONTAL"],
  [1, 0, "VERTICAL"],
  [1, 1, "DIAGONAL"],
  [1, -1, "ANTI_DIAGONAL"],
];

/** Full contiguous run of occupied cells through (r,c) along (dr,dc). */
function scanLine(
  stones: Set<string>,
  r: number,
  c: number,
  dr: number,
  dc: number,
): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [{ row: r, col: c }];
  let i = 1;
  while (stones.has(cellKey(r + dr * i, c + dc * i))) {
    cells.push({ row: r + dr * i, col: c + dc * i });
    i++;
  }
  i = 1;
  while (stones.has(cellKey(r - dr * i, c - dc * i))) {
    cells.unshift({ row: r - dr * i, col: c - dc * i });
    i++;
  }
  return cells;
}

export type PveOpResult<T> =
  | { ok: true; data: T }
  | { ok: false; httpStatus: number; code: string; message: string };

interface PveShopInternal {
  shopVisitId: string;
  runId: string;
  afterEncounterSequence: number;
  status: PveShopStatus;
  rerollCount: number;
  offers: PveShopOfferItem[];
}

interface PveEncounterInternal {
  encounterId: string;
  runId: string;
  sequence: number;
  fieldType: PveFieldType;
  mutationType: PveMutationType;
  boardRows: number;
  boardCols: number;
  bossHpMax: number;
  bossHpCurrent: number;
  moveBudget: number;
  movesUsed: number;
  status: PveEncounterStatus;
  stones: Set<string>;
  obstacles: { row: number; col: number }[];
  skillUsableThisInterval: boolean;
  /** 本關已使用技能清單，依使用順序，可含重複（api.yml usedSkills, FR-B7）。 */
  usedSkills: SkillType[];
  lastResolution: PveLastResolution | null;
  events: PveEncounterEvent[];
  /** internal-only bookkeeping (not serialized): cumulative removed-stone
   * count this encounter, drives RECYCLER's +1 move-budget/10 removed. */
  removedStoneCount: number;
}

interface PveRunInternal {
  runId: string;
  playerId: string;
  classType: ClassType;
  status: PveRunStatus;
  gold: number;
  currentEncounterSequence: number;
  reachedEncounterSequence: number;
  totalDamageDealt: number;
  currentEncounterId: string | null;
  heldSkills: { skillType: SkillType; quantity: number }[];
  heldRelics: { relicType: RelicType }[];
  goldEarned: number;
  goldSpent: number;
  /** METRONOME: permanent multiplier bonus, +0.1 per 5 cumulative moves. */
  metronomeBonus: number;
  totalMovesInRun: number;
  shop: PveShopInternal | null;
  rng: () => number;
}

export const pveRuns = new Map<string, PveRunInternal>();
const pveEncounters = new Map<string, PveEncounterInternal>();
/** single mock user convention (matches games/mockRooms elsewhere in this
 * mock layer): only one PVE run is "current" at a time. */
let currentRunId: string | null = null;
let pveRunSeq = 0;
let demoSeeded = false;

function hasRelic(run: PveRunInternal, type: RelicType) {
  return run.heldRelics.some((r) => r.relicType === type);
}

function isObstacle(enc: PveEncounterInternal, row: number, col: number) {
  return enc.obstacles.some((o) => o.row === row && o.col === col);
}

function createEncounterInternal(run: PveRunInternal, sequence: number): PveEncounterInternal {
  const fieldType: PveFieldType = PVE_FIXED_PLAIN_SEQUENCES.includes(sequence)
    ? "PLAIN"
    : run.rng() < 0.5
      ? "VOLCANO"
      : "BEACH";
  const mutationType = PVE_MUTATION_BY_SEQUENCE[sequence] ?? "NONE";
  const obstacles: { row: number; col: number }[] = [];
  if (fieldType === "VOLCANO") {
    const span = PVE_VOLCANO_OBSTACLE_MAX - PVE_VOLCANO_OBSTACLE_MIN + 1;
    const count = PVE_VOLCANO_OBSTACLE_MIN + Math.floor(run.rng() * span);
    const used = new Set<string>();
    let guard = 0;
    while (used.size < count && guard < 200) {
      guard++;
      const r = Math.floor(run.rng() * PVE_INITIAL_BOARD_ROWS);
      const c = Math.floor(run.rng() * PVE_INITIAL_BOARD_COLS);
      if (r === 5 && c === 5) continue; // keep board centre open
      const k = cellKey(r, c);
      if (used.has(k)) continue;
      used.add(k);
      obstacles.push({ row: r, col: c });
    }
  }
  const encounterId = `pve-enc-${run.runId}-${sequence}`;
  const encounter: PveEncounterInternal = {
    encounterId,
    runId: run.runId,
    sequence,
    fieldType,
    mutationType,
    boardRows: PVE_INITIAL_BOARD_ROWS,
    boardCols: PVE_INITIAL_BOARD_COLS,
    bossHpMax: PVE_BOSS_HP_CURVE[sequence - 1],
    bossHpCurrent: PVE_BOSS_HP_CURVE[sequence - 1],
    moveBudget: PVE_MOVE_BUDGET,
    movesUsed: 0,
    status: "IN_PROGRESS",
    stones: new Set(),
    obstacles,
    skillUsableThisInterval: true,
    usedSkills: [],
    lastResolution: null,
    events: [],
    removedStoneCount: 0,
  };
  pveEncounters.set(encounterId, encounter);
  return encounter;
}

function toEncounterResponse(e: PveEncounterInternal): PveEncounterStateResponse {
  return {
    encounterId: e.encounterId,
    runId: e.runId,
    sequence: e.sequence,
    fieldType: e.fieldType,
    mutationType: e.mutationType,
    boardRows: e.boardRows,
    boardCols: e.boardCols,
    bossHpMax: e.bossHpMax,
    bossHpCurrent: e.bossHpCurrent,
    moveBudget: e.moveBudget,
    movesUsed: e.movesUsed,
    status: e.status,
    stones: Array.from(e.stones).map(parseCellKey),
    obstacles: e.obstacles.map((o) => ({ row: o.row, col: o.col })),
    skillUsableThisInterval: e.skillUsableThisInterval,
    usedSkills: [...e.usedSkills],
    lastResolution: e.lastResolution,
    events: e.events,
  };
}

function toRunResponse(run: PveRunInternal): PveRunStateResponse {
  const enc = run.currentEncounterId ? pveEncounters.get(run.currentEncounterId) : undefined;
  return {
    runId: run.runId,
    classType: run.classType,
    status: run.status,
    gold: run.gold,
    currentEncounterSequence: run.currentEncounterSequence,
    reachedEncounterSequence: run.reachedEncounterSequence,
    totalDamageDealt: run.totalDamageDealt,
    currentEncounter: enc ? toEncounterResponse(enc) : null,
    heldSkills: run.heldSkills.map((s) => ({ ...s })),
    heldRelics: run.heldRelics.map((r) => ({ ...r })),
  };
}

function toRunResultResponse(run: PveRunInternal): PveRunResultResponse {
  return {
    runId: run.runId,
    status: run.status as PveRunResultStatus,
    reachedEncounterSequence: run.reachedEncounterSequence,
    totalDamageDealt: run.totalDamageDealt,
    goldEarned: run.goldEarned,
    goldSpent: run.goldSpent,
    finalHeldSkills: run.heldSkills.map((s) => ({ ...s })),
    finalHeldRelics: run.heldRelics.map((r) => ({ ...r })),
  };
}

function toShopResponse(run: PveRunInternal, shop: PveShopInternal): PveShopStateResponse {
  return {
    shopVisitId: shop.shopVisitId,
    runId: shop.runId,
    afterEncounterSequence: shop.afterEncounterSequence,
    status: shop.status,
    rerollCount: shop.rerollCount,
    gold: run.gold,
    offers: shop.offers.map((o) => ({ ...o })),
  };
}

function rollShopOffers(run: PveRunInternal): PveShopOfferItem[] {
  const held = new Set(run.heldRelics.map((r) => r.relicType));
  const relicPool = ALL_RELIC_TYPES.filter((r) => !held.has(r));
  const relics = pickN(relicPool, 2, run.rng);
  const skillPool = PVE_CLASS_SKILL_POOL[run.classType];
  const skill = skillPool[Math.floor(run.rng() * skillPool.length)];
  return [
    {
      slotIndex: 0,
      offerKind: "RELIC",
      relicType: relics[0] ?? null,
      skillType: null,
      price: PVE_RELIC_SHOP_PRICE,
      purchased: false,
    },
    {
      slotIndex: 1,
      offerKind: "RELIC",
      relicType: relics[1] ?? null,
      skillType: null,
      price: PVE_RELIC_SHOP_PRICE,
      purchased: false,
    },
    {
      slotIndex: 2,
      offerKind: "SKILL",
      relicType: null,
      skillType: skill,
      price: PVE_SKILL_SHOP_PRICE,
      purchased: false,
    },
  ];
}

function buildShop(run: PveRunInternal, afterSequence: number): PveShopInternal {
  return {
    shopVisitId: `pve-shop-${run.runId}-${afterSequence}`,
    runId: run.runId,
    afterEncounterSequence: afterSequence,
    status: "OPEN",
    rerollCount: 0,
    offers: rollShopOffers(run),
  };
}

/** 通關結算：金幣獎勵 = 10 + 剩餘手數；第8關通關直接 Run 結算 WON，否則開商店。 */
function settleEncounterClear(run: PveRunInternal, enc: PveEncounterInternal) {
  run.reachedEncounterSequence = Math.max(run.reachedEncounterSequence, enc.sequence);
  const remaining = Math.max(0, enc.moveBudget - enc.movesUsed);
  const reward = PVE_CLEAR_GOLD_BASE + remaining;
  run.gold += reward;
  run.goldEarned += reward;
  if (enc.sequence >= 8) {
    run.status = "WON";
    currentRunId = null;
    run.currentEncounterId = null;
    return;
  }
  run.shop = buildShop(run, enc.sequence);
}

/** ABYSS (第8關)：每次連線結算後於隨機空格生成1顆障礙棋子。 */
function spawnAbyssObstacle(enc: PveEncounterInternal, run: PveRunInternal) {
  const empties: { row: number; col: number }[] = [];
  for (let r = 0; r < enc.boardRows; r++) {
    for (let c = 0; c < enc.boardCols; c++) {
      if (!enc.stones.has(cellKey(r, c)) && !isObstacle(enc, r, c)) empties.push({ row: r, col: c });
    }
  }
  if (empties.length === 0) return;
  const pick = empties[Math.floor(run.rng() * empties.length)];
  enc.obstacles.push(pick);
  enc.events.push({ eventType: "BOSS_MUTATION_TRIGGERED", row: pick.row, col: pick.col });
}

/** RAGE (第6關)：每落5手隨機噴發清除一格及周圍8格，不計傷（除非持有VOLCANO_HEART）。 */
function triggerRageBurst(enc: PveEncounterInternal, run: PveRunInternal) {
  const stoneKeys = Array.from(enc.stones);
  if (stoneKeys.length === 0) return;
  const centerKey = stoneKeys[Math.floor(run.rng() * stoneKeys.length)];
  const { row: cr, col: cc } = parseCellKey(centerKey);
  let cleared = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (enc.stones.delete(cellKey(cr + dr, cc + dc))) {
        cleared += 1;
        enc.removedStoneCount += 1;
      }
    }
  }
  if (hasRelic(run, "VOLCANO_HEART") && cleared > 0) {
    const dmg = cleared * 10;
    enc.bossHpCurrent = Math.max(0, enc.bossHpCurrent - dmg);
    run.totalDamageDealt += dmg;
  }
  enc.events.push({ eventType: "BOSS_MUTATION_TRIGGERED", row: cr, col: cc });
  if (hasRelic(run, "RECYCLER")) {
    enc.moveBudget = PVE_MOVE_BUDGET + Math.floor(enc.removedStoneCount / 10);
  }
  if (enc.bossHpCurrent <= 0 && enc.status === "IN_PROGRESS") {
    enc.status = "CLEARED";
    enc.events.push({ eventType: "ENCOUNTER_CLEARED", row: null, col: null });
    settleEncounterClear(run, enc);
  }
}

/** Seed one other-owner run (magic id) so abandonRun's 403 branch is
 * reachable without a real multi-user auth model. Idempotent. */
export function ensurePveDemoFixtures() {
  if (demoSeeded) return;
  demoSeeded = true;
  const runId = "pve-run-other-owner";
  const run: PveRunInternal = {
    runId,
    playerId: PVE_OTHER_PLAYER_ID,
    classType: "WARRIOR",
    status: "IN_PROGRESS",
    gold: 10,
    currentEncounterSequence: 1,
    reachedEncounterSequence: 0,
    totalDamageDealt: 0,
    currentEncounterId: null,
    heldSkills: [{ skillType: PVE_STARTER_SKILL.WARRIOR, quantity: 1 }],
    heldRelics: [],
    goldEarned: 0,
    goldSpent: 0,
    metronomeBonus: 0,
    totalMovesInRun: 0,
    shop: null,
    rng: makeRng(runId),
  };
  pveRuns.set(runId, run);
  const enc = createEncounterInternal(run, 1);
  run.currentEncounterId = enc.encounterId;

  // Second demo fixture: an already-ended (WON) run with a fixed id, so e2e
  // coverage of the結算畫面 can exercise the real `GET /pve/runs/{runId}/result`
  // endpoint (api.yml:833-875) without scripting a full 8-encounter
  // playthrough — same "magic id" technique as pve-run-other-owner above.
  const wonRunId = "pve-run-e2e-won";
  const wonRun: PveRunInternal = {
    runId: wonRunId,
    playerId: PVE_MOCK_PLAYER_ID,
    classType: "WARRIOR",
    status: "WON",
    gold: 80,
    currentEncounterSequence: 8,
    reachedEncounterSequence: 8,
    totalDamageDealt: 3200,
    currentEncounterId: null,
    heldSkills: [{ skillType: "HORIZONTAL_SLASH", quantity: 2 }],
    heldRelics: [{ relicType: "SHARP_BLADE" }],
    goldEarned: 220,
    goldSpent: 140,
    metronomeBonus: 0,
    totalMovesInRun: 0,
    shop: null,
    rng: makeRng(wonRunId),
  };
  pveRuns.set(wonRunId, wonRun);
}

// ── operations (one per api.yml operationId) ────────────────────

export function createPveRun(classType: ClassType): PveOpResult<PveRunStateResponse> {
  ensurePveDemoFixtures();
  const existing = currentRunId ? pveRuns.get(currentRunId) : undefined;
  if (existing && existing.status === "IN_PROGRESS") {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.RUN_IN_PROGRESS };
  }
  const runId = `pve-run-${Date.now().toString(36)}-${++pveRunSeq}`;
  const run: PveRunInternal = {
    runId,
    playerId: PVE_MOCK_PLAYER_ID,
    classType,
    status: "IN_PROGRESS",
    gold: PVE_INITIAL_GOLD,
    currentEncounterSequence: 1,
    reachedEncounterSequence: 0,
    totalDamageDealt: 0,
    currentEncounterId: null,
    heldSkills: [{ skillType: PVE_STARTER_SKILL[classType], quantity: 1 }],
    heldRelics: [],
    goldEarned: 0,
    goldSpent: 0,
    metronomeBonus: 0,
    totalMovesInRun: 0,
    shop: null,
    rng: makeRng(runId),
  };
  pveRuns.set(runId, run);
  const enc = createEncounterInternal(run, 1);
  run.currentEncounterId = enc.encounterId;
  currentRunId = runId;
  return { ok: true, data: toRunResponse(run) };
}

export function getCurrentPveRun(): PveOpResult<PveRunStateResponse> {
  ensurePveDemoFixtures();
  const run = currentRunId ? pveRuns.get(currentRunId) : undefined;
  if (!run || run.status !== "IN_PROGRESS") {
    return { ok: false, httpStatus: 404, code: "404001", message: "沒有進行中的Run" };
  }
  return { ok: true, data: toRunResponse(run) };
}

export function abandonPveRun(runId: string): PveOpResult<PveRunResultResponse> {
  ensurePveDemoFixtures();
  const run = pveRuns.get(runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  if (run.playerId !== PVE_MOCK_PLAYER_ID) {
    return { ok: false, httpStatus: 403, code: "403001", message: PVE_ERROR.RUN_FORBIDDEN };
  }
  if (run.status !== "IN_PROGRESS") {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.RUN_NOT_IN_PROGRESS };
  }
  run.status = "ABANDONED";
  if (currentRunId === runId) currentRunId = null;
  return { ok: true, data: toRunResultResponse(run) };
}

/** GET /pve/runs/{runId}/result — 查詢已結束 Run 的權威結算（api.yml:833-875）。
 * 取代前端自行以 sessionStorage 推算 goldEarned/goldSpent/totalDamageDealt；
 * 僅限已結束（WON/LOST/ABANDONED）的 Run 可查，仍進行中則 422。 */
export function getPveRunResult(runId: string): PveOpResult<PveRunResultResponse> {
  ensurePveDemoFixtures();
  const run = pveRuns.get(runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  if (run.playerId !== PVE_MOCK_PLAYER_ID) {
    return { ok: false, httpStatus: 403, code: "403001", message: PVE_ERROR.RUN_FORBIDDEN };
  }
  if (run.status === "IN_PROGRESS") {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.RUN_STILL_IN_PROGRESS };
  }
  return { ok: true, data: toRunResultResponse(run) };
}

export function getPveEncounter(encounterId: string): PveOpResult<PveEncounterStateResponse> {
  ensurePveDemoFixtures();
  const enc = pveEncounters.get(encounterId);
  if (!enc) {
    return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.ENCOUNTER_NOT_FOUND };
  }
  return { ok: true, data: toEncounterResponse(enc) };
}

export function placePveMove(
  encounterId: string,
  row: number,
  col: number,
): PveOpResult<PveEncounterStateResponse> {
  ensurePveDemoFixtures();
  const enc = pveEncounters.get(encounterId);
  if (!enc) {
    return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.ENCOUNTER_NOT_FOUND };
  }
  const run = pveRuns.get(enc.runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  if (enc.status !== "IN_PROGRESS") {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.ENCOUNTER_ENDED };
  }
  if (isObstacle(enc, row, col)) {
    return { ok: false, httpStatus: 422, code: "422002", message: PVE_ERROR.CELL_OBSTACLE };
  }
  const k = cellKey(row, col);
  if (enc.stones.has(k)) {
    return { ok: false, httpStatus: 422, code: "422003", message: PVE_ERROR.CELL_OCCUPIED };
  }
  if (enc.movesUsed >= enc.moveBudget) {
    return { ok: false, httpStatus: 422, code: "422004", message: PVE_ERROR.MOVE_BUDGET_EXHAUSTED };
  }

  enc.stones.add(k);
  enc.movesUsed += 1;
  run.totalMovesInRun += 1;
  enc.skillUsableThisInterval = true;
  enc.events = [];
  enc.lastResolution = null;

  // 節拍器 METRONOME：Run累計每5手倍率永久+0.1（遺物效果.feature #5）
  if (hasRelic(run, "METRONOME") && run.totalMovesInRun % 5 === 0) {
    run.metronomeBonus += 0.1;
  }

  // 連線偵測（連線傷害結算.feature）：一手最多4方向同時結算。
  const resolvedLines: {
    cells: { row: number; col: number }[];
    length: number;
    direction: PveLineDirection;
  }[] = [];
  for (const [dr, dc, direction] of PVE_LINE_DIRECTIONS) {
    const cells = scanLine(enc.stones, row, col, dr, dc);
    if (cells.length < 5) continue;
    // 獨眼 ONE_EYE（第3關）：橫向連線不結算，不移除、不計傷（Boss突變.feature #1）
    if (enc.mutationType === "ONE_EYE" && direction === "HORIZONTAL") continue;
    resolvedLines.push({ cells, length: cells.length, direction });
  }

  const removeSet = new Set<string>();
  const lineResolutions: PveLineResolution[] = [];
  let totalDamage = 0;
  for (const line of resolvedLines) {
    // 基礎分 = 50（五連） + 20 x（超過5顆的顆數）；銳刃 SHARP_BLADE 額外+20。
    let baseScore = 50 + 20 * (line.length - 5);
    if (hasRelic(run, "SHARP_BLADE")) baseScore += 20;
    // 斜行者 DIAGONAL_WALKER：斜向連線倍率+0.5；節拍器永久加成疊加於此。
    let multiplier = 1 + run.metronomeBonus;
    if (
      hasRelic(run, "DIAGONAL_WALKER") &&
      (line.direction === "DIAGONAL" || line.direction === "ANTI_DIAGONAL")
    ) {
      multiplier += 0.5;
    }
    const damage = Math.round(baseScore * multiplier);
    totalDamage += damage;
    lineResolutions.push({ length: line.length, baseScore, multiplier, direction: line.direction });
    for (const cell of line.cells) removeSet.add(cellKey(cell.row, cell.col));
    enc.events.push({ eventType: "LINE_RESOLVED", row: line.cells[0].row, col: line.cells[0].col });
  }

  // 雙子星 GEMINI_STAR：一手同時完成>=2條線時，該手總傷害x2。
  if (hasRelic(run, "GEMINI_STAR") && resolvedLines.length >= 2) {
    totalDamage *= 2;
  }

  for (const removed of Array.from(removeSet)) {
    enc.stones.delete(removed);
    enc.removedStoneCount += 1;
  }
  // 回收商 RECYCLER：連線移除棋子累計每10顆，手數預算+1（當關生效）。
  if (hasRelic(run, "RECYCLER")) {
    enc.moveBudget = PVE_MOVE_BUDGET + Math.floor(enc.removedStoneCount / 10);
  }

  if (totalDamage > 0) {
    enc.bossHpCurrent = Math.max(0, enc.bossHpCurrent - totalDamage);
    run.totalDamageDealt += totalDamage;
    enc.lastResolution = { damageDealt: totalDamage, linesResolved: lineResolutions };
  }

  // 深淵 ABYSS（第8關）：連線結算後隨機空格生成1顆障礙棋子（Boss突變.feature #5）。
  if (enc.mutationType === "ABYSS" && resolvedLines.length > 0 && enc.status === "IN_PROGRESS") {
    spawnAbyssObstacle(enc, run);
  }

  // 判定通過（HP<=0，關卡勝敗判定.feature #1/#2）。
  if (enc.status === "IN_PROGRESS" && enc.bossHpCurrent <= 0) {
    enc.status = "CLEARED";
    enc.events.push({ eventType: "ENCOUNTER_CLEARED", row: null, col: null });
    settleEncounterClear(run, enc);
  }

  // 震怒 RAGE（第6關）：每落5手隨機噴發（Boss突變.feature #3/#4），可能連帶通關。
  if (enc.mutationType === "RAGE" && enc.movesUsed % 5 === 0 && enc.status === "IN_PROGRESS") {
    triggerRageBurst(enc, run);
  }

  // 手數用盡且Boss HP>0 → 關卡失敗，Run立即終止為LOST（Run終止與結算.feature #1）。
  if (enc.status === "IN_PROGRESS" && enc.movesUsed >= enc.moveBudget) {
    enc.status = "FAILED";
    enc.events.push({ eventType: "ENCOUNTER_FAILED", row: null, col: null });
    run.status = "LOST";
    currentRunId = null;
  }

  return { ok: true, data: toEncounterResponse(enc) };
}

export function usePveSkill(
  encounterId: string,
  body: PveSkillUseRequest,
): PveOpResult<PveEncounterStateResponse> {
  ensurePveDemoFixtures();
  const enc = pveEncounters.get(encounterId);
  if (!enc) {
    return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.ENCOUNTER_NOT_FOUND };
  }
  const run = pveRuns.get(enc.runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  if (enc.status !== "IN_PROGRESS") {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.ENCOUNTER_ENDED };
  }
  const held = run.heldSkills.find((s) => s.skillType === body.skillType && s.quantity > 0);
  if (!held) {
    return { ok: false, httpStatus: 422, code: "422002", message: PVE_ERROR.SKILL_NOT_HELD };
  }
  if (!enc.skillUsableThisInterval) {
    return { ok: false, httpStatus: 422, code: "422003", message: PVE_ERROR.SKILL_USED_THIS_INTERVAL };
  }
  held.quantity -= 1;
  run.heldSkills = run.heldSkills.filter((s) => s.quantity > 0);
  enc.skillUsableThisInterval = false;
  enc.usedSkills.push(body.skillType);
  enc.events = [{ eventType: "SKILL_USED", row: null, col: null }];
  enc.lastResolution = null;
  // 消耗型獨立行動：不落子、不消耗手數（FR-A2 FR-B5）— movesUsed 不變。
  // 幾何效果（推移/替換/清範圍）不模擬，見檔頭 Scope note。
  return { ok: true, data: toEncounterResponse(enc) };
}

export function getPveShop(runId: string): PveOpResult<PveShopStateResponse> {
  ensurePveDemoFixtures();
  const run = pveRuns.get(runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  if (!run.shop) {
    return { ok: false, httpStatus: 404, code: "404002", message: PVE_ERROR.SHOP_NOT_FOUND };
  }
  return { ok: true, data: toShopResponse(run, run.shop) };
}

export function purchasePveShopOffer(
  runId: string,
  slotIndex: number,
): PveOpResult<PveShopStateResponse> {
  ensurePveDemoFixtures();
  const run = pveRuns.get(runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  const shop = run.shop;
  if (!shop || shop.status !== "OPEN") {
    return { ok: false, httpStatus: 404, code: "404002", message: PVE_ERROR.SHOP_NOT_FOUND };
  }
  const offer = shop.offers.find((o) => o.slotIndex === slotIndex);
  if (!offer || offer.purchased) {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.SHOP_OFFER_INVALID };
  }
  if (offer.offerKind === "RELIC" && run.heldRelics.length >= PVE_RELIC_HOLD_CAP) {
    return { ok: false, httpStatus: 422, code: "422002", message: PVE_ERROR.RELIC_CAP };
  }
  if (offer.offerKind === "SKILL") {
    const total = run.heldSkills.reduce((sum, s) => sum + s.quantity, 0);
    if (total >= PVE_SKILL_HOLD_CAP) {
      return { ok: false, httpStatus: 422, code: "422003", message: PVE_ERROR.SKILL_CAP };
    }
  }
  if (run.gold < offer.price) {
    return { ok: false, httpStatus: 422, code: "422004", message: PVE_ERROR.GOLD_INSUFFICIENT };
  }
  run.gold -= offer.price;
  run.goldSpent += offer.price;
  offer.purchased = true;
  if (offer.offerKind === "RELIC" && offer.relicType) {
    run.heldRelics.push({ relicType: offer.relicType });
  } else if (offer.offerKind === "SKILL" && offer.skillType) {
    const existing = run.heldSkills.find((s) => s.skillType === offer.skillType);
    if (existing) existing.quantity += 1;
    else run.heldSkills.push({ skillType: offer.skillType, quantity: 1 });
  }
  return { ok: true, data: toShopResponse(run, shop) };
}

export function rerollPveShop(runId: string): PveOpResult<PveShopStateResponse> {
  ensurePveDemoFixtures();
  const run = pveRuns.get(runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  const shop = run.shop;
  if (!shop || shop.status !== "OPEN") {
    return { ok: false, httpStatus: 404, code: "404002", message: PVE_ERROR.SHOP_NOT_FOUND };
  }
  if (run.gold < PVE_SHOP_REROLL_COST) {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.GOLD_INSUFFICIENT };
  }
  run.gold -= PVE_SHOP_REROLL_COST;
  run.goldSpent += PVE_SHOP_REROLL_COST;
  shop.rerollCount += 1;
  shop.offers = rollShopOffers(run);
  return { ok: true, data: toShopResponse(run, shop) };
}

export function skipPveShop(runId: string): PveOpResult<PveShopSkipResponse> {
  ensurePveDemoFixtures();
  const run = pveRuns.get(runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  const shop = run.shop;
  if (!shop || shop.status !== "OPEN") {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.SHOP_CLOSED };
  }
  shop.status = "CLOSED";
  run.shop = null;
  const nextSequence = run.currentEncounterSequence + 1;
  if (nextSequence > 8) {
    // Defensive branch only — normal flow settles seq-8 as WON directly from
    // placePveMove (no shop opens after clearing #8); this exists so the
    // union in PveShopSkipResponse has a reachable "result" arm too.
    run.status = "WON";
    currentRunId = null;
    return { ok: true, data: toRunResultResponse(run) };
  }
  run.currentEncounterSequence = nextSequence;
  const enc = createEncounterInternal(run, nextSequence);
  run.currentEncounterId = enc.encounterId;
  return { ok: true, data: toEncounterResponse(enc) };
}
