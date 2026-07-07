package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;

import java.util.ArrayList;
import java.util.List;

/**
 * Full-board scan for ALL maximal player lines (>= 5) on a PVE board
 * (FR-B2): one hand can complete up to 4 lines (one per direction), each
 * resolved independently; a 6+ run counts as ONE line with a longer base
 * score (FR-B3), never split into multiple 5-lines.
 */
public final class PveLineScanner {

    public enum Direction {
        HORIZONTAL(0, 1),
        VERTICAL(1, 0),
        DIAGONAL(1, 1),
        ANTI_DIAGONAL(1, -1);

        final int dr;
        final int dc;

        Direction(int dr, int dc) {
            this.dr = dr;
            this.dc = dc;
        }
    }

    public record Line(Direction direction, List<int[]> cells) {
        public int length() {
            return cells.size();
        }
    }

    private PveLineScanner() {
    }

    /** All maximal runs of {@code color} with length >= 5, across 4 directions. */
    public static List<Line> scanAll(SeriousBoard board, StoneColor color) {
        int size = board.size();
        List<Line> lines = new ArrayList<>();
        for (Direction dir : Direction.values()) {
            for (int r = 0; r < size; r++) {
                for (int c = 0; c < size; c++) {
                    if (board.stoneAt(r, c) != color) {
                        continue;
                    }
                    int pr = r - dir.dr;
                    int pc = c - dir.dc;
                    // Only start counting at the head of a run.
                    if (pr >= 0 && pr < size && pc >= 0 && pc < size && board.stoneAt(pr, pc) == color) {
                        continue;
                    }
                    List<int[]> cells = new ArrayList<>();
                    int cr = r;
                    int cc = c;
                    while (cr >= 0 && cr < size && cc >= 0 && cc < size && board.stoneAt(cr, cc) == color) {
                        cells.add(new int[]{cr, cc});
                        cr += dir.dr;
                        cc += dir.dc;
                    }
                    if (cells.size() >= 5) {
                        lines.add(new Line(dir, cells));
                    }
                }
            }
        }
        return lines;
    }
}
