package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;

import java.util.ArrayList;
import java.util.List;

/**
 * Server-authoritative Gomoku rules engine. Stateless; operates on a 15x15 board.
 *
 * Decision rules (clarified):
 *  - Win = 5 or more in a row (long-line counts as a win; "長連算勝").
 *  - No forbidden moves ("無禁手") — black has no restriction.
 *  - Draw when the board is full with no winner.
 */
public final class GomokuRules {

    public static final int SIZE = 15;

    private static final int[][] DIRECTIONS = {
            {0, 1},   // horizontal
            {1, 0},   // vertical
            {1, 1},   // diagonal down-right
            {1, -1}   // diagonal down-left
    };

    private GomokuRules() {
    }

    public static boolean inBounds(int row, int col) {
        return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
    }

    /**
     * After placing {@code color} at (row,col) on {@code board}, return the list of
     * winning-line cells if this move makes 5-or-more in a row; otherwise empty list.
     * {@code board[r][c]} holds the color or null for empty.
     */
    public static List<int[]> findWinningLine(StoneColor[][] board, int row, int col, StoneColor color) {
        for (int[] dir : DIRECTIONS) {
            int dr = dir[0];
            int dc = dir[1];

            List<int[]> line = new ArrayList<>();
            line.add(new int[]{row, col});

            // forward
            int r = row + dr, c = col + dc;
            while (inBounds(r, c) && board[r][c] == color) {
                line.add(new int[]{r, c});
                r += dr;
                c += dc;
            }
            // backward
            r = row - dr;
            c = col - dc;
            while (inBounds(r, c) && board[r][c] == color) {
                line.add(0, new int[]{r, c});
                r -= dr;
                c -= dc;
            }

            if (line.size() >= 5) {
                return line;
            }
        }
        return List.of();
    }

    public static boolean isWin(StoneColor[][] board, int row, int col, StoneColor color) {
        return !findWinningLine(board, row, col, color).isEmpty();
    }

    /** Board full (every cell occupied). */
    public static boolean isBoardFull(StoneColor[][] board) {
        for (int r = 0; r < SIZE; r++) {
            for (int c = 0; c < SIZE; c++) {
                if (board[r][c] == null) {
                    return false;
                }
            }
        }
        return true;
    }
}
