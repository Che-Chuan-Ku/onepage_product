import type { ClassType, SkillType } from "@/lib/types/schemas";

/**
 * PVE 頁面共用的顯示文字對照表（職業/技能中文名＋icon）。
 *
 * Skill *names* here intentionally match `SKILL_INFO` in
 * `src/app/game/[gameId]/page.tsx` (橫劈/縱劈/天地反轉…) for naming
 * consistency across PVP and PVE. We do NOT reuse that file's `desc`
 * strings, though: those describe PVP-only behavior ("落子時發動"、"一場
 * 限一次"、"取代本回合落子") which is explicitly wrong for PVE, where
 * every skill is an independent, consumable action decoupled from moves
 * (see pve-ui-spec.md §8-1 矛盾點 and documents/PVE-挑戰模式-增量需求.md
 * FR-A2/FR-B5). This file only carries names, not PVP behavior text.
 */
export const CLASS_NAME_ZH: Record<ClassType, string> = {
  WARRIOR: "劍士",
  ARCHER: "弓箭手",
};

export const CLASS_ICO: Record<ClassType, string> = {
  WARRIOR: "⚔️",
  ARCHER: "🏹",
};

export const SKILL_NAME_ZH: Record<SkillType, string> = {
  HORIZONTAL_SLASH: "橫劈",
  VERTICAL_SLASH: "縱劈",
  HEAVEN_EARTH_REVERSAL: "天地反轉（大絕）",
  PRECISION_SNIPE: "精準狙擊",
  SCATTER_SHOT: "散射",
  PIONEER_STAR: "開拓之星（大絕）",
};

/** PVE 職業技能組說明（僅列出技能名稱，不描述 PVP 落子行為），供職業選擇頁卡片顯示。 */
export const CLASS_SKILL_LIST_ZH: Record<ClassType, string[]> = {
  WARRIOR: ["橫劈 HORIZONTAL_SLASH（附贈）", "縱劈 VERTICAL_SLASH", "大絕：天地反轉 HEAVEN_EARTH_REVERSAL"],
  ARCHER: ["精準狙擊 PRECISION_SNIPE（附贈）", "散射 SCATTER_SHOT", "大絕：開拓之星 PIONEER_STAR"],
};
