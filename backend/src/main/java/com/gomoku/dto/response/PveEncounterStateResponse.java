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
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record PveEncounterStateResponse(
        String encounterId,
        String runId,
        int sequence,
        String fieldType,
        String mutationType,
        int boardRows,
        int boardCols,
        int bossHpMax,
        int bossHpCurrent,
        int moveBudget,
        int movesUsed,
        String status,
        List<Cell> stones,
        List<Cell> obstacles,
        boolean skillUsableThisInterval,
        Resolution lastResolution,
        List<EventView> events,
        List<String> usedSkills
) {
    public record Cell(int row, int col) {
    }

    public record Resolution(int damageDealt, List<LineView> linesResolved) {
    }

    public record LineView(int length, int baseScore, double multiplier, String direction) {
    }

    public record EventView(String eventType, Integer row, Integer col) {
    }
}
