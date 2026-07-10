import type { ClassType, RelicType, SkillType } from "@/lib/types/schemas";

/**
 * PVE 挑戰模式 fixture constants — every value here is sourced from
 * specs/features/pve/*.feature (see pve-features-spec.md for the extracted
 * Given/Then values); nothing here is invented. Two exceptions are flagged
 * inline where the feature files don't give an exact number and the value
 * is instead taken from api.yml's own `example:` field.
 */

// ── 職業/建關 (建立挑戰與職業選擇.feature) ──
export const PVE_STARTER_SKILL: Record<ClassType, SkillType> = {
  WARRIOR: "HORIZONTAL_SLASH",
  ARCHER: "PRECISION_SNIPE",
};

// 商店技能位僅從本職業技能池抽取（金幣與商店.feature #4，WARRIOR池明列）。
// ARCHER 池未在任何 feature 檔逐字列出，依 6 技能對半分配的既有職業歸屬類比
// 補上（HEAVEN_EARTH_REVERSAL/PIONEER_STAR 為大絕，各職業各一），未見反例。
export const PVE_CLASS_SKILL_POOL: Record<ClassType, SkillType[]> = {
  WARRIOR: ["HORIZONTAL_SLASH", "VERTICAL_SLASH", "HEAVEN_EARTH_REVERSAL"],
  ARCHER: ["PRECISION_SNIPE", "SCATTER_SHOT", "PIONEER_STAR"],
};

export const PVE_INITIAL_GOLD = 0;
export const PVE_INITIAL_BOARD_ROWS = 11;
export const PVE_INITIAL_BOARD_COLS = 11;

// ── Run循環與場地排程.feature（2026-07-08 關卡重做 + 2026-07-09 魔王對弈與
//    策略引導改版，documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §3.1）──
//    第4/8關固定改為 DUEL（魔王對弈，見下方 PVE_DUEL_SEQUENCES/PVE_DUEL_*），
//    不再有 BossHP/預放雛形概念（陣列對應索引為 0 sentinel）；其餘6個PUZZLE
//    關重新主題化並重算HP/預算曲線：50/90/100/-/180/212/315/-、2/4/6/-/9/16/13/-。
export const PVE_BOSS_HP_CURVE = [50, 90, 100, 0, 180, 212, 315, 0];
export const PVE_MOVE_BUDGET_CURVE = [2, 4, 6, 0, 9, 16, 13, 0];
export const PVE_FIXED_PLAIN_SEQUENCES = [1, 3, 6]; // DUEL關（4/8）另外固定PLAIN，見下方
export const PVE_RANDOM_FIELD_SEQUENCES = [2, 5, 7]; // seed 50% VOLCANO/BEACH

// ── 魔王對弈 DUEL（全8關，documents/PVE-全對弈階梯設計-2026-07-10.md §1）──
// L2/L7 為07-09文件已驗證定案值（45/70）；其餘6格為該文件的設計起始值，經
// backend N=200統計驗收校準（見 documents/PVE-全對弈階梯設計-2026-07-10.md
// 校準記錄）。mock 的 Boss AI 本就不實作真實決策表（見下方 duelBossMove 註解），
// 這裡的 PROFILE 常數僅供型別/文件對照用，不驅動任何 mock 行為分歧。
export const PVE_DUEL_SEQUENCES = [1, 2, 3, 4, 5, 6, 7, 8];
export const PVE_DUEL_MOVE_BUDGET: Record<number, number> = {
  1: 50,
  2: 45,
  3: 55,
  4: 55,
  5: 60,
  6: 65,
  7: 70,
  8: 75,
};
export const PVE_DUEL_PROFILE: Record<number, "NOVICE" | "APPRENTICE" | "ELITE" | "TRUE_DEMON"> = {
  1: "NOVICE",
  2: "APPRENTICE",
  3: "APPRENTICE",
  4: "ELITE",
  5: "ELITE",
  6: "ELITE",
  7: "TRUE_DEMON",
  8: "TRUE_DEMON",
};
export const PVE_DUEL_OPENING_SCRIPT: Record<number, "HUAYUE" | "PUYUE"> = {
  2: "HUAYUE",
  7: "PUYUE",
  8: "PUYUE",
};
// L3限定「不可橫向」（§4.1，雙方對稱，全遊戲僅此關）。
export const PVE_DUEL_HORIZONTAL_DISABLED_SEQUENCE = 3;
// L5固定VOLCANO（開局一次性5-8格靜態岩石，無隱藏噴發，§4.2）；L6固定BEACH
// （沿用每10手推浪，§4.3）；其餘DUEL關固定PLAIN。
export const PVE_DUEL_VOLCANO_SEQUENCE = 5;
export const PVE_DUEL_BEACH_SEQUENCE = 6;

// ── 每關預放黑棋雛形（§0 §2）── TYPE_A「開三取五」(2手可解，offsets{1,2,3}
// 已預放、{0,4}待補)／TYPE_B「缺一取五」(1手可解，offsets{0,1,3,4}已預放、
// {2}待補)。orientation VERTICAL 時 line=固定欄、start=起始列；HORIZONTAL 時
// line=固定列、start=起始欄。同 backend/src/main/resources/pve/level-
// templates.json，僅供 mock 產生初始棋子與渲染，不含備援線（不影響解謎路徑）。
export type PveShapeType = "TYPE_A" | "TYPE_B";
export interface PveShapeSpec {
  type: PveShapeType;
  orientation: "VERTICAL" | "HORIZONTAL";
  line: number;
  start: number;
}
const shapeFilledOffsets = (type: PveShapeType) => (type === "TYPE_A" ? [1, 2, 3] : [0, 1, 3, 4]);
export function shapeFilledCells(shape: PveShapeSpec): { row: number; col: number }[] {
  return shapeFilledOffsets(shape.type).map((off) =>
    shape.orientation === "VERTICAL"
      ? { row: shape.start + off, col: shape.line }
      : { row: shape.line, col: shape.start + off },
  );
}
// 2026-07-09 改版：sequence 4/8 移除（改為DUEL，見PVE_DUEL_*常數），不再有
// 模板概念；其餘6關同步 backend/src/main/resources/pve/level-templates.json
// 的新主題化內容（L1=衝四單一TYPE_B、L5=死四活三精簡為2+2、L6=雙三+RAGE
// 沿用舊L5的3+2欄位、L7=雙死四新增1條橫向row-band達成3+4）。
export const PVE_LEVEL_TEMPLATES: Record<number, { templateA: PveShapeSpec[]; templateB: PveShapeSpec[] }> = {
  1: {
    templateA: [{ type: "TYPE_B", orientation: "VERTICAL", line: 4, start: 2 }],
    templateB: [{ type: "TYPE_B", orientation: "VERTICAL", line: 4, start: 5 }],
  },
  2: {
    templateA: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 2 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 8, start: 2 },
    ],
    templateB: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 5 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 8, start: 5 },
    ],
  },
  3: {
    templateA: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 2 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 8, start: 2 },
    ],
    templateB: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 5 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 8, start: 5 },
    ],
  },
  5: {
    templateA: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 0, start: 2 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 2 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 6, start: 2 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 8, start: 2 },
    ],
    templateB: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 0, start: 5 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 5 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 6, start: 5 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 8, start: 5 },
    ],
  },
  6: {
    templateA: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 0, start: 2 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 2 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 4, start: 2 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 6, start: 2 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 8, start: 2 },
    ],
    templateB: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 0, start: 5 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 5 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 4, start: 5 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 6, start: 5 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 8, start: 5 },
    ],
  },
  7: {
    templateA: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 0, start: 2 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 2 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 4, start: 2 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 6, start: 2 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 8, start: 2 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 10, start: 2 },
      { type: "TYPE_B", orientation: "HORIZONTAL", line: 9, start: 3 },
    ],
    templateB: [
      { type: "TYPE_A", orientation: "VERTICAL", line: 0, start: 5 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 2, start: 5 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 4, start: 5 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 6, start: 5 },
      { type: "TYPE_A", orientation: "VERTICAL", line: 8, start: 5 },
      { type: "TYPE_B", orientation: "VERTICAL", line: 10, start: 5 },
      { type: "TYPE_B", orientation: "HORIZONTAL", line: 1, start: 3 },
    ],
  },
};

// ── Boss突變.feature ── 2026-07-09: 第8關改DUEL，ABYSS retired（無關卡使用）。
export const PVE_MUTATION_BY_SEQUENCE: Record<number, "NONE" | "ONE_EYE" | "RAGE" | "ABYSS"> = {
  1: "NONE",
  2: "NONE",
  3: "ONE_EYE",
  4: "NONE",
  5: "NONE",
  6: "RAGE",
  7: "NONE",
  8: "NONE",
};

// ── 遺物效果.feature（8個，名稱與效果摘要原樣抄錄） ──
export const PVE_RELIC_INFO: Record<RelicType, { name: string; summary: string }> = {
  SHARP_BLADE: { name: "銳刃", summary: "連線基礎分+20" },
  CHAIN_CORE: { name: "連鎖核心", summary: "技能推移連鎖距離+1格" },
  DIAGONAL_WALKER: { name: "斜行者", summary: "斜向連線倍率+0.5" },
  VOLCANO_HEART: { name: "火山之心", summary: "噴發清除棋子每顆對Boss造成10傷害" },
  TIDE_BREAKWATER: { name: "防潮堤", summary: "海浪/漲潮不移動不移除玩家棋子" },
  METRONOME: { name: "節拍器", summary: "落子計數Run全程累計，每逢累計第5倍數手倍率+0.1永久生效" },
  RECYCLER: { name: "回收商", summary: "連線移除棋子累計每10顆，手數預算+1（當關生效）" },
  GEMINI_STAR: { name: "雙子星", summary: "一手同時完成>=2條線時，該手總傷害x2" },
};
export const ALL_RELIC_TYPES = Object.keys(PVE_RELIC_INFO) as RelicType[];
export const PVE_RELIC_HOLD_CAP = 5;

// ── 金幣與商店.feature ──
export const PVE_SKILL_SHOP_PRICE = 6; // 售價固定6（scenario 8）
// api.yml PveShopOfferItem.price example:8（api.yml:1693-1697 附近）——features
// 未給遺物售價的逐字數字，沿用 api.yml example 作為遺物展示位的固定售價。
export const PVE_RELIC_SHOP_PRICE = 8;
export const PVE_SHOP_REROLL_COST = 5;
export const PVE_SKILL_HOLD_CAP = 3;
export const PVE_CLEAR_GOLD_BASE = 10; // 通關獎勵 = 10 + 剩餘手數

// ── VOLCANO 場地生成（Run循環與場地排程.feature #5） ──
export const PVE_VOLCANO_OBSTACLE_MIN = 3;
export const PVE_VOLCANO_OBSTACLE_MAX = 5;

// ── 錯誤訊息（逐字對齊 features，供 handler fail() message 使用） ──
export const PVE_ERROR = {
  RUN_IN_PROGRESS: "已有進行中的Run，須先結束才能建立新Run",
  GUEST_FORBIDDEN: "PVE挑戰模式僅限已登入玩家",
  RELIC_CAP: "遺物持有已達上限",
  SKILL_CAP: "技能持有已達上限",
  GOLD_INSUFFICIENT: "金幣不足",
  SKILL_USED_THIS_INTERVAL: "本間隔已使用過技能",
  ENCOUNTER_ENDED: "關卡已結束",
  SKILL_NOT_HELD: "未持有該技能",
  // 逐字對齊後端 PveChallengeService.requireAnchor()（backend/.../PveChallengeService.java:392-395）
  // 的 422 訊息：橫劈/縱劈（axis）在 PVE 情境下 anchor 為推擠參考格且必填
  // （api.yml SkillActionRequest.anchor 說明），mock 先前完全未驗證此欄位，
  // 導致真後端才會擋下的契約違反在 mock 下被靜默放行（見本次交付回報）。
  ANCHOR_REQUIRED: "必須指定施法錨點",
  // 以下訊息未在 features 逐字出現，是既有慣例延伸（照抄業務語意，非逐字定案）：
  RUN_NOT_FOUND: "Run不存在",
  RUN_NOT_IN_PROGRESS: "Run已結束，無法執行此操作",
  RUN_STILL_IN_PROGRESS: "Run仍進行中，尚未結束，無法查詢結算",
  RUN_FORBIDDEN: "非本人的Run",
  ENCOUNTER_NOT_FOUND: "關卡不存在",
  CELL_OCCUPIED: "該位置已有棋子",
  CELL_OBSTACLE: "該格為障礙格，禁止落子",
  MOVE_BUDGET_EXHAUSTED: "手數已用盡",
  SHOP_NOT_FOUND: "商店不存在或尚未開啟",
  SHOP_CLOSED: "商店已結束",
  SHOP_OFFER_INVALID: "展示位不合法或已被購買",
  UNAUTHORIZED: "未登入或憑證無效",
  // 逐字對齊後端 PveChallengeService.retryDuelEncounter()（2026-07-09 §1.5/§6.5 公平性修正）。
  ENCOUNTER_NOT_DUEL: "只有魔王對弈關可以重試",
  ENCOUNTER_NOT_DRAWN: "關卡非和局狀態，無法重試",
} as const;

// ── 座標範例（連線傷害結算.feature，供 e2e / demo 佈局參考） ──
export const PVE_DEMO_LINE_SETUP = {
  fiveInARow: [
    { row: 5, col: 3 },
    { row: 5, col: 4 },
    { row: 5, col: 5 },
    { row: 5, col: 6 },
  ],
  fiveInARowCompletion: { row: 5, col: 7 },
};

// ── 測試帳號 (供 handler 的單一 mock 使用者與 403 demo run) ──
export const PVE_MOCK_PLAYER_ID = "p-001"; // "alice" in feature Background，沿用既有 mock 慣例 id
export const PVE_OTHER_PLAYER_ID = "p-zhe"; // 既有 mock 慣例的假對手 id，借用來觸發 403 分支
