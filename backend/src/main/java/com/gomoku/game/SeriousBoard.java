package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;

/**
 * Mutable Serious Duel board state: stones + obstacle mask, sized per field
 * (volcano 15x15, beach 16x16). Server-authoritative working model rebuilt
 * from the immutable move/effect event streams (see BoardReplayer).
 */
public final class SeriousBoard {

    private final int size;
    private final StoneColor[][] stones;
    private final boolean[][] obstacles;

    public SeriousBoard(int size) {
        this.size = size;
        this.stones = new StoneColor[size][size];
        this.obstacles = new boolean[size][size];
    }

    public int size() { return size; }

    public boolean inBounds(int row, int col) {
        return row >= 0 && row < size && col >= 0 && col < size;
    }

    public StoneColor stoneAt(int row, int col) {
        return stones[row][col];
    }

    public boolean hasStone(int row, int col) {
        return stones[row][col] != null;
    }

    public void setStone(int row, int col, StoneColor color) {
        stones[row][col] = color;
    }

    public void removeStone(int row, int col) {
        stones[row][col] = null;
    }

    public boolean isObstacle(int row, int col) {
        return obstacles[row][col];
    }

    public void setObstacle(int row, int col) {
        obstacles[row][col] = true;
    }

    /** Empty = in bounds, no stone, not an obstacle. */
    public boolean isEmptyPlayable(int row, int col) {
        return inBounds(row, col) && !obstacles[row][col] && stones[row][col] == null;
    }

    /** All playable (non-obstacle) cells occupied → draw condition. */
    public boolean isFull() {
        for (int r = 0; r < size; r++) {
            for (int c = 0; c < size; c++) {
                if (!obstacles[r][c] && stones[r][c] == null) {
                    return false;
                }
            }
        }
        return true;
    }

    /** Direct access for win scanning. */
    public StoneColor[][] stones() {
        return stones;
    }
}
