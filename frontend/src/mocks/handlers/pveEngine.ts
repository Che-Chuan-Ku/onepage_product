import type {
  ClassType,
  PveEncounterEvent,
  PveEncounterStateResponse,
  PveEncounterStatus,
  PveEncounterType,
  PveFieldType,
  PveLastResolution,
  PveLineDirection,
  PveLineResolution,
  PveMutationType,
  PveObstacleKind,
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
  PVE_DUEL_BEACH_SEQUENCE,
  PVE_DUEL_HORIZONTAL_DISABLED_SEQUENCE,
  PVE_DUEL_MOVE_BUDGET,
  PVE_DUEL_OPENING_SCRIPT,
  PVE_DUEL_SEQUENCES,
  PVE_DUEL_VOLCANO_SEQUENCE,
  PVE_ERROR,
  PVE_FIXED_PLAIN_SEQUENCES,
  PVE_INITIAL_BOARD_COLS,
  PVE_INITIAL_BOARD_ROWS,
  PVE_INITIAL_GOLD,
  PVE_LEVEL_TEMPLATES,
  PVE_MOCK_PLAYER_ID,
  PVE_MOVE_BUDGET_CURVE,
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
  shapeFilledCells,
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
  /** 2026-07-09 新增：PUZZLE（消線關）或 DUEL（第4/8關魔王對弈，§1.0）。 */
  encounterType: PveEncounterType;
  boardRows: number;
  boardCols: number;
  bossHpMax: number;
  bossHpCurrent: number;
  moveBudget: number;
  movesUsed: number;
  status: PveEncounterStatus;
  /** DUEL關的玩家黑子與PUZZLE關的雛形黑棋共用同一個 Set。 */
  stones: Set<string>;
  /** kind: ROCK（VOLCANO/legacy ABYSS障礙）或 ENEMY_STONE（DUEL關Boss活棋）。 */
  obstacles: { row: number; col: number; kind: PveObstacleKind }[];
  skillUsableThisInterval: boolean;
  /** 本關「玩家」已使用技能清單，依使用順序，可含重複（api.yml usedSkills, FR-B7）。 */
  usedSkills: SkillType[];
  /** 本關「Boss」已使用技能清單（bug fix, additive — 與 usedSkills 分開，避免前端無標註混淆）。 */
  bossUsedSkills: SkillType[];
  lastResolution: PveLastResolution | null;
  events: PveEncounterEvent[];
  /** internal-only bookkeeping (not serialized): cumulative removed-stone
   * count this encounter, drives RECYCLER's +1 move-budget/10 removed. */
  removedStoneCount: number;
  /** DUEL only: number of BOSS_MOVE_PLACED replies so far (drives opening-script-vs-AI branch). */
  bossMoveCount: number;
  /** L3 only (documents/PVE-全對弈階梯設計-2026-07-10.md §4.1): horizontal five-in-a-row doesn't count as a win. */
  horizontalDisabled: boolean;
  /** L8 SKILL_DEMON only (§3/§9.2): boss-cast skill events accumulated this settlement, surfaced as bossSkillEvents. */
  bossSkillEvents: { skillType: SkillType; cells: { row: number; col: number }[] }[];
}

interface PveRunInternal {
  runId: string;
  /** Original createRun seed string (FR-A3), kept verbatim (not just fed into `rng`) so e2e can opt into test-only behavior via a seed marker — see DRAW_TEST_SEED_MARKER. */
  seed: string;
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

/**
 * 2026-07-09 §1.5/§6.5 公平性修正 — e2e 測試用途：`createPveRun` 的 seed 字串
 * 若包含此標記，**第2關**（DRAW e2e 的目標關卡）的 moveBudget 直接壓到 1
 * （而非設計值 45），讓 e2e 能在單一玩家落子內就觸發手數耗盡＝DRAW，不需要
 * 真的跑滿一整場對局。比照既有 `pve-run-e2e-won`「magic id」手法
 * （ensurePveDemoFixtures 檔頭）同一精神：只影響測試專用 seed，不影響一般
 * 玩家流程。
 *
 * 2026-07-10 修正：全對弈化（全8關皆DUEL）後，標記若套用到所有 DUEL 關會讓
 * 第1關（budget=1）根本贏不了，e2e 無法推進到第2關——故收斂為只作用於
 * 第2關（原本只有 4/8 是 DUEL 時「全部 DUEL 壓到 1」與「只壓目標關」等效，
 * 現在不再等效）。
 */
const DRAW_TEST_SEED_MARKER = "pve-drawtest";
const DRAW_TEST_TARGET_SEQUENCE = 2;

/**
 * e2e 測試鉤子（§7.6 item #2 L3 即時回饋 e2e 需要直達第3關）：seed 後綴
 * `-pve-startseq-<n>` 讓新 Run 直接從第 n 關開始（reached=n-1），免去 e2e
 * 真打贏前面每一關的冗長流程。同 DRAW_TEST_SEED_MARKER 精神：只影響帶標記
 * 的測試 seed，一般玩家流程不受影響；剝掉標記後綴再餵 rng，維持既有 seed
 * 的 RNG 序列不跑位。
 */
const START_SEQUENCE_SEED_MARKER = /-pve-startseq-([1-8])$/;

function createEncounterInternal(run: PveRunInternal, sequence: number): PveEncounterInternal {
  const encounterId = `pve-enc-${run.runId}-${sequence}`;

  if (PVE_DUEL_SEQUENCES.includes(sequence)) {
    // 魔王對弈 DUEL（documents/PVE-全對弈階梯設計-2026-07-10.md §1）：全8關皆為
    // DUEL，無BossHP/傷害/消線機制；勝負由玩家連五/Boss連五/手數用盡決定（見
    // placePveMove 的 DUEL 分支）。L5固定VOLCANO(一次性岩石)、L6固定BEACH，
    // 其餘固定PLAIN；L3橫向連五不算勝（前端提示用，判定邏輯不在mock內，見
    // PveBoard.tsx horizontalDisabled prop）。
    const moveBudget =
      run.seed.includes(DRAW_TEST_SEED_MARKER) && sequence === DRAW_TEST_TARGET_SEQUENCE
        ? 1
        : PVE_DUEL_MOVE_BUDGET[sequence];
    const fieldType: PveFieldType =
      sequence === PVE_DUEL_VOLCANO_SEQUENCE ? "VOLCANO" : sequence === PVE_DUEL_BEACH_SEQUENCE ? "BEACH" : "PLAIN";
    const obstacles: { row: number; col: number; kind: PveObstacleKind }[] = [];
    if (fieldType === "VOLCANO") {
      const span = PVE_VOLCANO_OBSTACLE_MAX - PVE_VOLCANO_OBSTACLE_MIN + 1;
      const count = 5 + Math.floor(run.rng() * (span + 3)); // 5..8 (§4.2)
      const used = new Set<string>();
      let guard = 0;
      while (used.size < count && guard < 200) {
        guard++;
        const r = Math.floor(run.rng() * PVE_INITIAL_BOARD_ROWS);
        const c = Math.floor(run.rng() * PVE_INITIAL_BOARD_COLS);
        const k = cellKey(r, c);
        if (used.has(k)) continue;
        used.add(k);
        obstacles.push({ row: r, col: c, kind: "ROCK" });
      }
    }
    const encounter: PveEncounterInternal = {
      encounterId,
      runId: run.runId,
      sequence,
      fieldType,
      mutationType: "NONE",
      encounterType: "DUEL",
      boardRows: PVE_INITIAL_BOARD_ROWS,
      boardCols: PVE_INITIAL_BOARD_COLS,
      bossHpMax: 0,
      bossHpCurrent: 0,
      moveBudget,
      movesUsed: 0,
      status: "IN_PROGRESS",
      stones: new Set<string>(),
      obstacles,
      skillUsableThisInterval: true,
      usedSkills: [],
    bossUsedSkills: [],
      lastResolution: null,
      events: [],
      removedStoneCount: 0,
      bossMoveCount: 0,
      horizontalDisabled: sequence === PVE_DUEL_HORIZONTAL_DISABLED_SEQUENCE,
      bossSkillEvents: [],
    };
    pveEncounters.set(encounterId, encounter);
    return encounter;
  }

  const fieldType: PveFieldType = PVE_FIXED_PLAIN_SEQUENCES.includes(sequence)
    ? "PLAIN"
    : run.rng() < 0.5
      ? "VOLCANO"
      : "BEACH";
  const mutationType = PVE_MUTATION_BY_SEQUENCE[sequence] ?? "NONE";
  const obstacles: { row: number; col: number; kind: PveObstacleKind }[] = [];
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
      obstacles.push({ row: r, col: c, kind: "ROCK" });
    }
  }
  // 預放黑棋雛形（documents/PVE-關卡重設計-2026-07-08.md §0 §2）：Template A/B
  // 2選1（seed 50%），補完雛形即為本關的解謎手數 T，與 moveBudget 相互印證。
  const level = PVE_LEVEL_TEMPLATES[sequence];
  const shapes = run.rng() < 0.5 ? level.templateA : level.templateB;
  const stones = new Set<string>();
  for (const shape of shapes) {
    for (const cell of shapeFilledCells(shape)) {
      stones.add(cellKey(cell.row, cell.col));
    }
  }

  const encounter: PveEncounterInternal = {
    encounterId,
    runId: run.runId,
    sequence,
    fieldType,
    mutationType,
    encounterType: "PUZZLE",
    boardRows: PVE_INITIAL_BOARD_ROWS,
    boardCols: PVE_INITIAL_BOARD_COLS,
    bossHpMax: PVE_BOSS_HP_CURVE[sequence - 1],
    bossHpCurrent: PVE_BOSS_HP_CURVE[sequence - 1],
    moveBudget: PVE_MOVE_BUDGET_CURVE[sequence - 1],
    movesUsed: 0,
    status: "IN_PROGRESS",
    stones,
    obstacles,
    skillUsableThisInterval: true,
    usedSkills: [],
    bossUsedSkills: [],
    lastResolution: null,
    events: [],
    removedStoneCount: 0,
    bossMoveCount: 0,
    horizontalDisabled: false,
    bossSkillEvents: [],
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
    encounterType: e.encounterType,
    boardRows: e.boardRows,
    boardCols: e.boardCols,
    bossHpMax: e.bossHpMax,
    bossHpCurrent: e.bossHpCurrent,
    moveBudget: e.moveBudget,
    movesUsed: e.movesUsed,
    status: e.status,
    stones: Array.from(e.stones).map(parseCellKey),
    obstacles: e.obstacles.map((o) => ({ row: o.row, col: o.col, kind: o.kind })),
    skillUsableThisInterval: e.skillUsableThisInterval,
    usedSkills: [...e.usedSkills],
    bossUsedSkills: [...e.bossUsedSkills],
    lastResolution: e.lastResolution,
    events: e.events,
    horizontalDisabled: e.horizontalDisabled,
    bossSkillEvents: e.bossSkillEvents.map((ev) => ({ skillType: ev.skillType, cells: ev.cells.map((c) => ({ ...c })) })),
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

/**
 * A2 修正（2026-07-08 調校輪，同步 PveShopOfferDrawer.drawSlots）：固定
 * relic x2+skill x1 的展示位配置，在該類別已達持有上限時會出現「賣不出去
 * 也占位」的廢卡。改為依上限動態決定relic/skill槽位數：技能達上限時（且
 * 遺物未達上限、遺物池還有>=3種可抽）改抽3件遺物；遺物達上限時（且技能未
 * 達上限）改抽3件技能。兩類同時達上限時維持舊配置（2 relic+1 skill，皆不
 * 可購買）——這是無替代品可補時的僅存例外。
 */
function rollShopOffers(run: PveRunInternal): PveShopOfferItem[] {
  const held = new Set(run.heldRelics.map((r) => r.relicType));
  const relicPool = ALL_RELIC_TYPES.filter((r) => !held.has(r));
  const skillPool = PVE_CLASS_SKILL_POOL[run.classType];

  const totalSkillQty = run.heldSkills.reduce((sum, s) => sum + s.quantity, 0);
  const skillCapped = totalSkillQty >= PVE_SKILL_HOLD_CAP;
  const relicCapped = run.heldRelics.length >= PVE_RELIC_HOLD_CAP;

  let relicSlots = 2;
  if (skillCapped && !relicCapped && relicPool.length >= 3) {
    relicSlots = 3;
  } else if (relicCapped && !skillCapped) {
    relicSlots = 0;
  }

  const relics = pickN(relicPool, relicSlots, run.rng);
  const offers: PveShopOfferItem[] = [];
  for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
    if (slotIndex < relicSlots) {
      offers.push({
        slotIndex,
        offerKind: "RELIC",
        relicType: relics[slotIndex] ?? null,
        skillType: null,
        price: PVE_RELIC_SHOP_PRICE,
        purchased: false,
      });
    } else {
      offers.push({
        slotIndex,
        offerKind: "SKILL",
        relicType: null,
        skillType: skillPool[Math.floor(run.rng() * skillPool.length)],
        price: PVE_SKILL_SHOP_PRICE,
        purchased: false,
      });
    }
  }
  return offers;
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
  enc.obstacles.push({ ...pick, kind: "ROCK" });
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
    enc.moveBudget = PVE_MOVE_BUDGET_CURVE[enc.sequence - 1] + Math.floor(enc.removedStoneCount / 10);
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
    seed: runId,
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
    seed: wonRunId,
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

export function createPveRun(classType: ClassType, seed?: string): PveOpResult<PveRunStateResponse> {
  ensurePveDemoFixtures();
  const existing = currentRunId ? pveRuns.get(currentRunId) : undefined;
  if (existing && existing.status === "IN_PROGRESS") {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.RUN_IN_PROGRESS };
  }
  const runId = `pve-run-${Date.now().toString(36)}-${++pveRunSeq}`;
  // 決定性測試注入（api.yml PveRunCreateRequest.seed，FR-A3）：呼叫端可傳入固定
  // seed 讓場地/雛形模板挑選（Template A/B、VOLCANO/BEACH）可重現，供 e2e 精確
  // 斷言座標；省略時仍以 runId 產生亂數 seed（一般玩家流程不受影響）。
  const runSeed = seed && seed.length > 0 ? seed : runId;
  // §1.5/§6.5 公平性修正 e2e 測試鉤子：DRAW_TEST_SEED_MARKER 只影響 DUEL 關的
  // moveBudget 覆寫（見 createEncounterInternal），若直接把含標記的完整字串餵
  // 進 makeRng 會連帶改變第1-3關（PUZZLE）的場地/雛形模板RNG序列，讓既有
  // e2e 依賴的固定座標斷言全部跑位。餵給 rng 的字串先剝掉標記後綴，讓
  // "<既有已驗證seed>-pve-drawtest" 在 PUZZLE 關的行為與裸 "<既有已驗證seed>"
  // 完全一致，只有 DUEL 關的 moveBudget 覆寫會生效。
  const startSeqMatch = runSeed.match(START_SEQUENCE_SEED_MARKER);
  const startSequence = startSeqMatch ? Number(startSeqMatch[1]) : 1;
  const rngBase = startSeqMatch ? runSeed.slice(0, -startSeqMatch[0].length) : runSeed;
  const rngSeed = rngBase.endsWith(`-${DRAW_TEST_SEED_MARKER}`)
    ? rngBase.slice(0, -(DRAW_TEST_SEED_MARKER.length + 1))
    : rngBase;
  const run: PveRunInternal = {
    runId,
    seed: runSeed,
    playerId: PVE_MOCK_PLAYER_ID,
    classType,
    status: "IN_PROGRESS",
    gold: PVE_INITIAL_GOLD,
    currentEncounterSequence: startSequence,
    reachedEncounterSequence: startSequence - 1,
    totalDamageDealt: 0,
    currentEncounterId: null,
    heldSkills: [{ skillType: PVE_STARTER_SKILL[classType], quantity: 1 }],
    heldRelics: [],
    goldEarned: 0,
    goldSpent: 0,
    metronomeBonus: 0,
    totalMovesInRun: 0,
    shop: null,
    rng: makeRng(rngSeed || runId),
  };
  pveRuns.set(runId, run);
  const enc = createEncounterInternal(run, startSequence);
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

// ── DUEL 魔王對弈 mock（documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §5.4）:
// 「mock 只做輕量 bookkeeping、不模擬完整伺服器邏輯」——不需要真的實作 §1.2
// 8層決策表，用一個「固定選最近候選格、必要時擋玩家已成形四」的極簡版本即可，
// 足以支撐前端 e2e（玩家五連→過關、Boss五連→失敗、手數用盡→失敗）；真正的
// BossAiPolicy 智力只在後端。
const DUEL_DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** True if `occupied` (already includes the hypothetical placement) has a run of >=5 through (r,c). */
/** `horizontalDisabled` (documents/PVE-全對弈階梯設計-2026-07-10.md §4.1, L3 unique twist): a horizontal-only five doesn't count as a win. */
function fiveThrough(occupied: Set<string>, r: number, c: number, horizontalDisabled = false): boolean {
  for (let dirIndex = 0; dirIndex < DUEL_DIRECTIONS.length; dirIndex++) {
    if (horizontalDisabled && dirIndex === 0) continue;
    const [dr, dc] = DUEL_DIRECTIONS[dirIndex];
    let run = 1;
    for (let i = 1; occupied.has(cellKey(r + dr * i, c + dc * i)); i++) run++;
    for (let i = 1; occupied.has(cellKey(r - dr * i, c - dc * i)); i++) run++;
    if (run >= 5) return true;
  }
  return false;
}

function duelOccupied(enc: PveEncounterInternal): Set<string> {
  const occ = new Set(enc.stones);
  for (const o of enc.obstacles) occ.add(cellKey(o.row, o.col));
  return occ;
}

/** Boss's OWN stones only (ENEMY_STONE obstacles) — a five-in-a-row check for
 * the boss must run on this set, NOT on `duelOccupied` (the union of both
 * colors): a union check lets the boss "win" with a mixed-color line — e.g.
 * its own forced block adjacent to the player's four counted as a boss five.
 * This was the root cause of the intermittently-failing pve duel e2e specs
 * (2026-07-10 修正). */
function duelBossStones(enc: PveEncounterInternal): Set<string> {
  return new Set(
    enc.obstacles.filter((o) => o.kind === "ENEMY_STONE").map((o) => cellKey(o.row, o.col)),
  );
}

/** Empty cells within Chebyshev<=2 of any stone; center if the board is blank. */
function duelCandidates(enc: PveEncounterInternal, occupied: Set<string>): { row: number; col: number }[] {
  if (occupied.size === 0) return [{ row: 5, col: 5 }];
  const seen = new Set<string>();
  const candidates: { row: number; col: number }[] = [];
  for (const key of Array.from(occupied)) {
    const { row: r, col: c } = parseCellKey(key);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= enc.boardRows || nc < 0 || nc >= enc.boardCols) continue;
        const k = cellKey(nr, nc);
        if (seen.has(k) || occupied.has(k)) continue;
        seen.add(k);
        candidates.push({ row: nr, col: nc });
      }
    }
  }
  if (candidates.length === 0) {
    // Dense/near-full board — widen to a full-board scan (mirrors backend's
    // PveDuelCandidates fallback, avoids ever silently reusing an occupied cell).
    for (let r = 0; r < enc.boardRows; r++) {
      for (let c = 0; c < enc.boardCols; c++) {
        if (!occupied.has(cellKey(r, c))) candidates.push({ row: r, col: c });
      }
    }
  }
  return candidates;
}

/** Boss's scripted first-move (§1.4): HUAYUE=orthogonal-adjacent, PUYUE=diagonal-adjacent; mirrors on overflow. */
function duelOpeningMove(
  script: "HUAYUE" | "PUYUE",
  playerRow: number,
  playerCol: number,
  boardSize: number,
): { row: number; col: number } {
  const max = boardSize - 1;
  const row = playerRow === max ? playerRow - 1 : playerRow + 1;
  const col =
    script === "HUAYUE" ? playerCol : playerCol === max ? playerCol - 1 : playerCol + 1;
  return { row, col };
}

/** Simplified boss move: own five > block player's five > nearest-to-center candidate. */
function simpleBossMove(enc: PveEncounterInternal): { row: number; col: number } {
  const occupied = duelOccupied(enc);
  const candidates = duelCandidates(enc, occupied);
  const bossStones = duelBossStones(enc); // own-five must be color-pure (see duelBossStones)
  for (const c of candidates) {
    const trial = new Set(bossStones);
    trial.add(cellKey(c.row, c.col));
    if (fiveThrough(trial, c.row, c.col, enc.horizontalDisabled)) return c; // own five
  }
  for (const c of candidates) {
    const trial = new Set(enc.stones);
    trial.add(cellKey(c.row, c.col));
    if (fiveThrough(trial, c.row, c.col, enc.horizontalDisabled)) return c; // block player's completing move
  }
  const center = 5;
  candidates.sort((a, b) => {
    const da = Math.max(Math.abs(a.row - center), Math.abs(a.col - center));
    const db = Math.max(Math.abs(b.row - center), Math.abs(b.col - center));
    return da - db;
  });
  return candidates[0];
}

/** DUEL branch of placePveMove (§1.5): no damage/mutation settlement at all — pure five-in-a-row + boss reply. */
function placeDuelMove(
  enc: PveEncounterInternal,
  run: PveRunInternal,
  row: number,
  col: number,
): PveOpResult<PveEncounterStateResponse> {
  const k = cellKey(row, col);
  enc.stones.add(k);
  enc.movesUsed += 1;
  enc.skillUsableThisInterval = true;
  enc.events = [];
  enc.bossSkillEvents = [];
  enc.lastResolution = null;

  if (fiveThrough(enc.stones, row, col, enc.horizontalDisabled)) {
    enc.status = "CLEARED";
    enc.events.push({ eventType: "ENCOUNTER_CLEARED", row: null, col: null });
    settleEncounterClear(run, enc);
    return { ok: true, data: toEncounterResponse(enc) };
  }

  if (enc.movesUsed >= enc.moveBudget) {
    // 2026-07-09 §1.5/§6.5 公平性修正：手數耗盡且雙方皆未連五＝和局DRAW，不是
    // FAILED——Run不沒收（保持IN_PROGRESS），本關可原地無限次重試
    // （retryPveEncounter，見下方）。只有玩家有手數配額、Boss每手免費，
    // 雙方零失誤卻判玩家全責並不公平（設計文件§122-123 附近／L8模擬耗盡率
    // 44.2%）。
    enc.status = "DRAW";
    enc.events.push({ eventType: "ENCOUNTER_DRAWN", row: null, col: null });
    return { ok: true, data: toEncounterResponse(enc) };
  }

  // L8 "SKILL_DEMON" (documents/PVE-全對弈階梯設計-2026-07-10.md §3/§9.2): a
  // minimal, non-heuristic mock trigger — on the boss's 3rd reply, if the
  // player has at least one stone on the board, "snipe" the first one found
  // instead of a plain placement (施法佔用整手，不額外落子；real heuristics
  // stay backend-only, matching this mock engine's existing convention).
  if (enc.sequence === 8 && enc.bossMoveCount === 2 && enc.stones.size > 0) {
    const target = parseCellKey(Array.from(enc.stones)[0]);
    enc.stones.delete(cellKey(target.row, target.col));
    enc.obstacles.push({ row: target.row, col: target.col, kind: "ENEMY_STONE" });
    enc.bossMoveCount += 1;
    enc.bossSkillEvents.push({ skillType: "PRECISION_SNIPE", cells: [target] });
    enc.bossUsedSkills.push("PRECISION_SNIPE");
    enc.events.push({ eventType: "SKILL_USED", row: target.row, col: target.col });
    return { ok: true, data: toEncounterResponse(enc) };
  }

  const bossMove =
    enc.bossMoveCount === 0
      ? duelOpeningMove(PVE_DUEL_OPENING_SCRIPT[enc.sequence], row, col, enc.boardRows)
      : simpleBossMove(enc);
  enc.bossMoveCount += 1;
  enc.obstacles.push({ row: bossMove.row, col: bossMove.col, kind: "ENEMY_STONE" });
  enc.events.push({ eventType: "BOSS_MOVE_PLACED", row: bossMove.row, col: bossMove.col });

  // Boss-win check runs on the boss's OWN stones only (see duelBossStones —
  // a union-of-both-colors check here let the boss "win" via mixed lines).
  const bossStonesAfter = duelBossStones(enc);
  if (fiveThrough(bossStonesAfter, bossMove.row, bossMove.col, enc.horizontalDisabled)) {
    enc.status = "FAILED";
    enc.events.push({ eventType: "ENCOUNTER_FAILED", row: null, col: null });
    run.status = "LOST";
    currentRunId = null;
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

  if (enc.encounterType === "DUEL") {
    return placeDuelMove(enc, run, row, col);
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
    enc.moveBudget = PVE_MOVE_BUDGET_CURVE[enc.sequence - 1] + Math.floor(enc.removedStoneCount / 10);
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

/**
 * POST /pve/encounters/{encounterId}/actions/retry (2026-07-09 §1.5/§6.5
 * 公平性修正) — DUEL限定，關卡狀態須為DRAW：原地重開同一sequence（新
 * encounterId、盤面重新開始），Run本身不受影響。舊encounterId自map移除，
 * 之後查詢會404（比照後端軟刪除後 requireEncounter 找不到的行為）。
 */
export function retryPveEncounter(encounterId: string): PveOpResult<PveEncounterStateResponse> {
  ensurePveDemoFixtures();
  const enc = pveEncounters.get(encounterId);
  if (!enc) {
    return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.ENCOUNTER_NOT_FOUND };
  }
  const run = pveRuns.get(enc.runId);
  if (!run) return { ok: false, httpStatus: 404, code: "404001", message: PVE_ERROR.RUN_NOT_FOUND };
  if (enc.encounterType !== "DUEL") {
    return { ok: false, httpStatus: 422, code: "422001", message: PVE_ERROR.ENCOUNTER_NOT_DUEL };
  }
  if (enc.status !== "DRAW") {
    return { ok: false, httpStatus: 422, code: "422002", message: PVE_ERROR.ENCOUNTER_NOT_DRAWN };
  }
  pveEncounters.delete(encounterId);
  const fresh = createEncounterInternal(run, enc.sequence);
  run.currentEncounterId = fresh.encounterId;
  return { ok: true, data: toEncounterResponse(fresh) };
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
  // 橫劈/縱劈（axis）在 PVE 情境下 anchor＝推擠參考格，因技能獨立行動、無伴隨
  // 落子座標，故必填（api.yml SkillActionRequest.anchor 說明；後端
  // PveChallengeService.requireAnchor() 逐字同訊息）。mock 之前完全不驗證此欄位，
  // 掩蓋了 frontend page.tsx 曾經漏收集 anchor 的契約違反（真後端 100% 422）。
  const AXIS_SKILL_TYPES: SkillType[] = ["HORIZONTAL_SLASH", "VERTICAL_SLASH"];
  if (
    AXIS_SKILL_TYPES.includes(body.skillType) &&
    (body.anchor == null || body.anchor.row == null || body.anchor.col == null)
  ) {
    return { ok: false, httpStatus: 422, code: "422004", message: PVE_ERROR.ANCHOR_REQUIRED };
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
