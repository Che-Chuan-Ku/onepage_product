package com.gomoku.game;

import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.PveFieldType;
import com.gomoku.domain.enums.PveMutationType;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * Pure, seed-deterministic encounter planning (FR-C1 FR-C2 FR-A3):
 *  - Boss HP curve 100/160/260/420/670/1070/1710/2740;
 *  - mutations fixed to sequences 3 (ONE_EYE) / 6 (RAGE) / 8 (ABYSS);
 *  - fields: 1/3/4/6/8 PLAIN; 2/5/7 a seed-driven 50% VOLCANO or BEACH
 *    11x11 variant with 3-5 visible obstacles and at most 3 hidden cells.
 * Same seed + same sequence always yields the same plan (NFR-1).
 */
public final class PveFieldScheduler {

    public static final int[] BOSS_HP_CURVE = {100, 160, 260, 420, 670, 1070, 1710, 2740};
    public static final int MOVE_BUDGET = 30;
    public static final int ENCOUNTER_COUNT = 8;

    public record PlannedCell(FieldCellKind kind, int row, int col, boolean visible) {
    }

    public record EncounterPlan(int sequence, PveFieldType fieldType, PveMutationType mutationType,
                                int bossHpMax, int moveBudget, BoardSide seaSide,
                                List<PlannedCell> cells) {
    }

    private PveFieldScheduler() {
    }

    public static EncounterPlan plan(String runSeed, int sequence) {
        if (sequence < 1 || sequence > ENCOUNTER_COUNT) {
            throw new IllegalArgumentException("sequence must be 1..8, got " + sequence);
        }
        PveFieldType fieldType = fieldTypeFor(runSeed, sequence);
        PveMutationType mutation = mutationFor(sequence);
        int hp = BOSS_HP_CURVE[sequence - 1];

        BoardSide seaSide = null;
        List<PlannedCell> cells = new ArrayList<>();
        if (fieldType != PveFieldType.PLAIN) {
            Random rng = PveRandoms.forPurpose(runSeed, "field:" + sequence);
            Set<Integer> taken = new HashSet<>();
            if (fieldType == PveFieldType.VOLCANO) {
                int obstacles = 3 + rng.nextInt(3); // 3..5 visible (FR-C2)
                for (int[] pos : pickDistinct(rng, obstacles, taken)) {
                    cells.add(new PlannedCell(FieldCellKind.OBSTACLE, pos[0], pos[1], true));
                }
                int eruptions = 1 + rng.nextInt(3); // 1..3 hidden, at most 3
                for (int[] pos : pickDistinct(rng, eruptions, taken)) {
                    cells.add(new PlannedCell(FieldCellKind.ERUPTION, pos[0], pos[1], false));
                }
            } else { // BEACH
                seaSide = BoardSide.values()[rng.nextInt(BoardSide.values().length)];
                int tides = 1 + rng.nextInt(3); // 1..3 hidden, at most 3
                for (int[] pos : pickDistinct(rng, tides, taken)) {
                    cells.add(new PlannedCell(FieldCellKind.TIDE, pos[0], pos[1], false));
                }
            }
        }
        return new EncounterPlan(sequence, fieldType, mutation, hp, MOVE_BUDGET, seaSide, cells);
    }

    /** 1/3/4/6/8 PLAIN; 2/5/7 seed-driven 50% VOLCANO/BEACH (FR-C2). */
    public static PveFieldType fieldTypeFor(String runSeed, int sequence) {
        if (sequence == 2 || sequence == 5 || sequence == 7) {
            Random rng = PveRandoms.forPurpose(runSeed, "fieldtype:" + sequence);
            return rng.nextBoolean() ? PveFieldType.VOLCANO : PveFieldType.BEACH;
        }
        return PveFieldType.PLAIN;
    }

    /** Fixed mutation schedule (FR-C6). */
    public static PveMutationType mutationFor(int sequence) {
        return switch (sequence) {
            case 3 -> PveMutationType.ONE_EYE;
            case 6 -> PveMutationType.RAGE;
            case 8 -> PveMutationType.ABYSS;
            default -> PveMutationType.NONE;
        };
    }

    private static List<int[]> pickDistinct(Random rng, int count, Set<Integer> taken) {
        List<int[]> picked = new ArrayList<>(count);
        while (picked.size() < count) {
            int r = rng.nextInt(PveFieldGeometry.BOARD_SIZE);
            int c = rng.nextInt(PveFieldGeometry.BOARD_SIZE);
            int key = r * PveFieldGeometry.BOARD_SIZE + c;
            if (taken.add(key)) {
                picked.add(new int[]{r, c});
            }
        }
        return picked;
    }
}
