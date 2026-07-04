package com.gomoku.game;

import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.FieldType;
import com.gomoku.domain.enums.SkillDirection;

import java.util.ArrayList;
import java.util.List;

/**
 * Static geometry for Serious Duel fields and skills:
 *  - board size per field (volcano/normal 15, beach 16);
 *  - ultimate 3-wide x 2-deep target zone (Q4);
 *  - eruption 8-neighborhood (Q5);
 *  - beach ocean/erosion layout and wave push direction (Q6/Q7).
 */
public final class FieldGeometry {

    public static final int NORMAL_SIZE = 15;
    public static final int BEACH_SIZE = 16;
    /** Beach starts half ocean, half sand: 8 rows each (Q6). */
    public static final int BEACH_INITIAL_SEA_ROWS = 8;

    private FieldGeometry() {
    }

    public static int boardSize(FieldType fieldType) {
        return fieldType == FieldType.BEACH ? BEACH_SIZE : NORMAL_SIZE;
    }

    /**
     * Ultimate zone: 3-wide x 2-deep block INCLUDING the (empty) anchor in the
     * chosen direction — rows/cols anchor+0d (the anchor's own line) and
     * anchor+1d (one step further), each 3 cells wide (per the reviewed
     * feature examples in 劍士技能組/弓箭手技能組: anchor (5,5) dir RIGHT affects
     * (4,5),(5,5),(6,5) at depth 0 and (4,6),(5,6),(6,6) at depth 1 — the
     * anchor cell itself is part of the zone, but must be empty per the
     * precondition rule). Off-board cells are omitted.
     */
    public static List<int[]> ultimateZone(int anchorRow, int anchorCol, SkillDirection dir, int size) {
        List<int[]> cells = new ArrayList<>(6);
        int dr = dir.dRow();
        int dc = dir.dCol();
        // Perpendicular axis: vertical for LEFT/RIGHT, horizontal for UP/DOWN.
        int pr = (dr == 0) ? 1 : 0;
        int pc = (dr == 0) ? 0 : 1;
        for (int depth = 0; depth <= 1; depth++) {
            for (int side = -1; side <= 1; side++) {
                int r = anchorRow + depth * dr + side * pr;
                int c = anchorCol + depth * dc + side * pc;
                if (r >= 0 && r < size && c >= 0 && c < size) {
                    cells.add(new int[]{r, c});
                }
            }
        }
        return cells;
    }

    /** The 8 in-bounds neighbors of an eruption cell (trigger stone excluded by caller). */
    public static List<int[]> eightNeighbors(int row, int col, int size) {
        List<int[]> cells = new ArrayList<>(8);
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                if (dr == 0 && dc == 0) {
                    continue;
                }
                int r = row + dr;
                int c = col + dc;
                if (r >= 0 && r < size && c >= 0 && c < size) {
                    cells.add(new int[]{r, c});
                }
            }
        }
        return cells;
    }

    /** Is (row,col) currently an ocean cell, given sea side + erosion progress (Q6/Q7)? */
    public static boolean isOcean(int row, int col, BoardSide seaSide, int erodedRows) {
        int oceanDepth = BEACH_INITIAL_SEA_ROWS + erodedRows;
        return switch (seaSide) {
            case NORTH -> row < oceanDepth;
            case SOUTH -> row >= BEACH_SIZE - oceanDepth;
            case WEST -> col < oceanDepth;
            case EAST -> col >= BEACH_SIZE - oceanDepth;
        };
    }

    /** Wave push direction: from the ocean toward the sand (Q7). */
    public static SkillDirection wavePushDirection(BoardSide seaSide) {
        return switch (seaSide) {
            case NORTH -> SkillDirection.DOWN;
            case SOUTH -> SkillDirection.UP;
            case WEST -> SkillDirection.RIGHT;
            case EAST -> SkillDirection.LEFT;
        };
    }

    /**
     * The sand line (row or col index) eroded next — the sand row closest to the
     * sea after {@code erodedRows} erosions; -1 when everything is ocean already.
     */
    public static int nextErodedLine(BoardSide seaSide, int erodedRows) {
        int oceanDepth = BEACH_INITIAL_SEA_ROWS + erodedRows;
        if (oceanDepth >= BEACH_SIZE) {
            return -1;
        }
        return switch (seaSide) {
            case NORTH, WEST -> oceanDepth;
            case SOUTH, EAST -> BEACH_SIZE - 1 - oceanDepth;
        };
    }

    /** All 16 cells of a sand line (row for NORTH/SOUTH sea, col for EAST/WEST). */
    public static List<int[]> lineCells(BoardSide seaSide, int lineIndex) {
        List<int[]> cells = new ArrayList<>(BEACH_SIZE);
        boolean horizontal = seaSide == BoardSide.NORTH || seaSide == BoardSide.SOUTH;
        for (int i = 0; i < BEACH_SIZE; i++) {
            cells.add(horizontal ? new int[]{lineIndex, i} : new int[]{i, lineIndex});
        }
        return cells;
    }
}
