package com.gomoku.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * api.yml PveEncounterStateResponse: encounter rendering + resume state
 * (FR-B6). {@code stones} = the player's stones; {@code obstacles} = volcano
 * obstacle cells PLUS abyss-generated obstacle stones (FR-C2 FR-C6).
 * {@code usedSkills} is additive (FR-B6/B7 need the used-skill list on
 * reconnect and settlement screens). {@code lastResolution}/{@code events}
 * are per-settlement and null/empty on plain GET reads.
 * {@code encounterType} (2026-07-09 魔王對弈與策略引導設計 §5.1/§5.2): "PUZZLE" or
 * "DUEL" — frontend hides the HP bar and damage/line copy for DUEL, showing
 * move-count/turn-order UI instead. {@code obstacles[].kind} additive field:
 * "ROCK" (VOLCANO obstacle / legacy ABYSS stone) vs "ENEMY_STONE" (a DUEL
 * boss stone, still "in play" — must render as a normal white stone, not the
 * rock icon).
 *
 * <p>{@code usedSkills} vs {@code bossUsedSkills} (bug fix, task item #5):
 * {@code usedSkills} is PLAYER-cast skills only; {@code bossUsedSkills}
 * (additive) is the L8 SKILL_DEMON boss's own one-shot casts this encounter
 * (parallel history list, distinct from the per-settlement {@code
 * bossSkillEvents}) — previously both were merged into one undifferentiated
 * {@code usedSkills} list with no way for the frontend to tell a boss cast
 * apart from the player's own, which is what the "無標註" bug reported.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record PveEncounterStateResponse(
        String encounterId,
        String runId,
        int sequence,
        String fieldType,
        String mutationType,
        String encounterType,
        int boardRows,
        int boardCols,
        int bossHpMax,
        int bossHpCurrent,
        int moveBudget,
        int movesUsed,
        String status,
        List<Cell> stones,
        List<ObstacleCell> obstacles,
        boolean skillUsableThisInterval,
        Resolution lastResolution,
        List<EventView> events,
        List<String> usedSkills,
        boolean horizontalDisabled,
        List<BossSkillEventView> bossSkillEvents,
        List<String> bossUsedSkills
) {
    public record Cell(int row, int col) {
    }

    /** kind: "ROCK" (VOLCANO obstacle / legacy ABYSS stone) or "ENEMY_STONE" (DUEL boss stone, §5.2). */
    public record ObstacleCell(int row, int col, String kind) {
    }

    public record Resolution(int damageDealt, List<LineView> linesResolved) {
    }

    public record LineView(int length, int baseScore, double multiplier, String direction) {
    }

    public record EventView(String eventType, Integer row, Integer col) {
    }

    /**
     * additive（documents/PVE-全對弈階梯設計-2026-07-10.md §3/§9.2）: L8
     * SKILL_DEMON boss-cast skill events in THIS settlement only (parallel to
     * {@code events}) — lets the frontend play the "boss cast a skill"
     * animation variant instead of silently reusing the player-cast one.
     * {@code cells} carries the skill's affected cells: PRECISION_SNIPE = the
     * 1 converted cell; SCATTER_SHOT = the 2 placed cells; PIONEER_STAR = every
     * cell cleared in the swept zone.
     */
    public record BossSkillEventView(String skillType, List<Cell> cells) {
    }
}
