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
 *  - BOSS_MUTATION_TRIGGERED(ABYSS): event row/col = generated obstacle stone.
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
        List<Push> pushes
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
                cells, null, null, null);
    }

    public static PveEventDetail skill(String skillType, List<Cell> placed, List<Cell> removed,
                                       List<Cell> swapped) {
        return new PveEventDetail(skillType, null, null, null, null, null, null,
                removed, placed, swapped, null);
    }

    public static PveEventDetail pushes(List<Push> pushes) {
        return new PveEventDetail(null, null, null, null, null, null, null,
                null, null, null, pushes);
    }

    public static PveEventDetail removedCells(List<Cell> cells) {
        return new PveEventDetail(null, null, null, null, null, null, null,
                cells, null, null, null);
    }

    public static PveEventDetail mutation(String mutation, List<Cell> cells, Integer damage) {
        return new PveEventDetail(null, mutation, null, null, null, null, damage,
                cells, null, null, null);
    }
}
