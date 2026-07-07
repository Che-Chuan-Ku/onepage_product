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
export const PVE_MOVE_BUDGET = 30;

// ── Run循環與場地排程.feature ──
// 8關固定順序；bossHpMax 曲線（index 0 = 第1關）。
export const PVE_BOSS_HP_CURVE = [100, 160, 260, 420, 670, 1070, 1710, 2740];
export const PVE_FIXED_PLAIN_SEQUENCES = [1, 3, 4, 6, 8];
export const PVE_RANDOM_FIELD_SEQUENCES = [2, 5, 7]; // seed 50% VOLCANO/BEACH

// ── Boss突變.feature ──
export const PVE_MUTATION_BY_SEQUENCE: Record<number, "NONE" | "ONE_EYE" | "RAGE" | "ABYSS"> = {
  1: "NONE",
  2: "NONE",
  3: "ONE_EYE",
  4: "NONE",
  5: "NONE",
  6: "RAGE",
  7: "NONE",
  8: "ABYSS",
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
