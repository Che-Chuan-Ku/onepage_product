package com.gomoku.game;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * JSON payload of a pve_encounter_events row. One flexible shape (NON_NULL
 * serialized) instead of one class per event type; PveBoardReplayer relies on:
 *  - LINE_RESOLVED: {@code cells} = the removed line cells;
 *  - SKILL_USED: {@code placed} stones added, {@code cells} stones removed,
 *    {@code swapped} stones recolored;
 *  - STONES_PUSHED: {@code pushes} (each stone moves exactly once; off-board
 *    removals are emitted as separate STONE_REMOVED_OFF_BOARD events BEFORE
 *    the push event so replay stays order-correct);
 *  - VOLCANO_ERUPTED / BOSS_MUTATION_TRIGGERED(RAGE): {@code cells} removed;
 *  - BOSS_MUTATION_TRIGGERED(ABYSS): event row/col = generated obstacle stone;
 *  - ENCOUNTER_FAILED (DUEL only, 2026-07-09 設計): {@code reason} =
 *    "BOSS_FIVE" | "MOVES_EXHAUSTED" so the frontend can pick the right
 *    failure copy (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §5.2);
 *  - BOSS_MOVE_PLACED (§7.6 統計可稽核, additive, debug/replay only): {@code
 *    aiFacedOpenThree}/{@code aiSkipRolled}/{@code aiTeachingForcedBlock} =
 *    the BossAiPolicy.MoveAudit flags for that reply (null detail when no
 *    flag is set — pre-§7.6 events simply lack the fields). aiFacedOpenThree
 *    additionally feeds the L1 NOVICE teaching counter ("每局前2次玩家活三
 *    必擋", see PveChallengeService#bossFacedOpenThreeCount).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PveEventDetail(
        String skillType,
        String mutation,
        String direction,
        Integer length,
        Integer baseScore,
        Double multiplier,
        Integer damage,
        List<Cell> cells,
        List<Cell> placed,
        List<Cell> swapped,
        List<Push> pushes,
        String reason,
        String caster,
        Boolean aiFacedOpenThree,
        Boolean aiSkipRolled,
        Boolean aiTeachingForcedBlock
) {
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Cell(int row, int col, String color) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Push(int fromRow, int fromCol, int toRow, int toCol, String color) {
    }

    public static PveEventDetail line(String direction, int length, int baseScore,
                                      double multiplier, int damage, List<Cell> cells) {
        return new PveEventDetail(null, null, direction, length, baseScore, multiplier, damage,
                cells, null, null, null, null, null, null, null, null);
    }

    public static PveEventDetail skill(String skillType, List<Cell> placed, List<Cell> removed,
                                       List<Cell> swapped) {
        return new PveEventDetail(skillType, null, null, null, null, null, null,
                removed, placed, swapped, null, null, null, null, null, null);
    }

    /**
     * L8 SKILL_DEMON boss-cast skill event (documents/PVE-全對弈階梯設計-2026-07-10.md
     * §3.1–3.3): identical shape to {@link #skill}, plus {@code caster="BOSS"}
     * so the frontend can render the "this is the boss's cast" animation
     * variant and the statistics/charge-tracking logic can distinguish it
     * from a player-cast PRECISION_SNIPE/SCATTER_SHOT of the same skillType.
     */
    public static PveEventDetail bossSkill(String skillType, List<Cell> placed, List<Cell> removed,
                                           List<Cell> swapped) {
        return new PveEventDetail(skillType, null, null, null, null, null, null,
                removed, placed, swapped, null, null, "BOSS", null, null, null);
    }

    public static PveEventDetail pushes(List<Push> pushes) {
        return new PveEventDetail(null, null, null, null, null, null, null,
                null, null, null, pushes, null, null, null, null, null);
    }

    public static PveEventDetail removedCells(List<Cell> cells) {
        return new PveEventDetail(null, null, null, null, null, null, null,
                cells, null, null, null, null, null, null, null, null);
    }

    public static PveEventDetail mutation(String mutation, List<Cell> cells, Integer damage) {
        return new PveEventDetail(null, mutation, null, null, null, null, damage,
                cells, null, null, null, null, null, null, null, null);
    }

    /** DUEL ENCOUNTER_FAILED reason (see class javadoc). */
    public static PveEventDetail failReason(String reason) {
        return new PveEventDetail(null, null, null, null, null, null, null,
                null, null, null, null, reason, null, null, null, null);
    }

    /**
     * §7.6 統計可稽核: BOSS_MOVE_PLACED AI-decision audit flags (additive,
     * debug/replay only) — returns null when no flag is set so unaudited boss
     * replies keep their pre-§7.6 null detail.
     */
    public static PveEventDetail aiAudit(BossAiPolicy.MoveAudit audit) {
        if (audit == null || !audit.any()) {
            return null;
        }
        return new PveEventDetail(null, null, null, null, null, null, null,
                null, null, null, null, null, null,
                audit.facedOpenThree() ? Boolean.TRUE : null,
                audit.openThreeSkipRolled() ? Boolean.TRUE : null,
                audit.teachingForcedBlock() ? Boolean.TRUE : null);
    }
}
