package com.gomoku.game;

import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.SkillDirection;

/**
 * PVE 11x11 geometry (FR-C2): a NEW geometry spec, deliberately separate from
 * the Serious Duel FieldGeometry (volcano 15 / beach 16). BEACH 11x11 starts
 * with 5 ocean lines and 6 sand lines (floor(11/2) = 5); the wave settles once
 * every 10 player placements.
 */
public final class PveFieldGeometry {

    public static final int BOARD_SIZE = 11;
    /** Initial ocean depth: floor(11/2) = 5 lines; sand = 6 lines (FR-C2). */
    public static final int INITIAL_SEA_ROWS = 5;
    /** Wave settles once every 10 player placements (FR-C2). */
    public static final int WAVE_HANDS = 10;

    private PveFieldGeometry() {
    }

    public static boolean inBounds(int row, int col) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }

    /** Is (row,col) currently an ocean cell, given sea side + erosion progress? */
    public static boolean isOcean(int row, int col, BoardSide seaSide, int erodedRows) {
        int oceanDepth = INITIAL_SEA_ROWS + erodedRows;
        return switch (seaSide) {
            case NORTH -> row < oceanDepth;
            case SOUTH -> row >= BOARD_SIZE - oceanDepth;
            case WEST -> col < oceanDepth;
            case EAST -> col >= BOARD_SIZE - oceanDepth;
        };
    }

    /** Wave push direction: from the ocean toward the sand. */
    public static SkillDirection wavePushDirection(BoardSide seaSide) {
        return switch (seaSide) {
            case NORTH -> SkillDirection.DOWN;
            case SOUTH -> SkillDirection.UP;
            case WEST -> SkillDirection.RIGHT;
            case EAST -> SkillDirection.LEFT;
        };
    }
}
