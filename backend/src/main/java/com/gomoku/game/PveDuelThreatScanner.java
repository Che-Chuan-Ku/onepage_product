package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;

import java.util.ArrayList;
import java.util.List;

/**
 * Hypothetical-placement threat evaluator shared by {@link BossAiPolicy} and
 * the DUEL win-scan in PveChallengeService (documents/PVE-魔王對弈與策略引導設計-
 * 2026-07-09.md §1.2 威脅分類表; documents/PVE-全對弈階梯設計-2026-07-10.md §4.1
 * "不可橫向" L3 twist): for an EMPTY cell and a color, "if this color played
 * here, what shape would result?" — evaluated independently in the 4 gomoku
 * directions (horizontal / vertical / diagonal / anti-diagonal) and combined
 * into the flags the decision table's 8 layers all read from.
 *
 * Definitions (identical to the design doc's table): for a direction, `run`
 * counts the maximal contiguous same-color length THROUGH the hypothetical
 * cell (including it); `opens` counts how many of the run's two flanks are
 * in-bounds + empty + not an obstacle (0, 1, or 2).
 *   five           run >= 5
 *   open four      run == 4 && opens == 2
 *   closed four    run == 4 && opens == 1
 *   open three     run == 3 && opens == 2
 * doubleThreat = at least 2 of the 4 directions independently qualify as
 * (open three OR closed four OR open four) — "一手同時製造 >=2 條活三或衝四"
 * (§1.2 layer 5, "威脅"包含衝四/活三/活四，任一達 2 條即成立).
 *
 * {@code diagonalContributesThreat} (2026-07-09 L4 見習魔王調校): true iff
 * either of the 2 diagonal directions ({@code DIRECTIONS[2]}/{@code [3]})
 * independently qualifies as open-three/closed-four/open-four — used by
 * {@link BossAiPolicy} to downweight L4's diagonal-direction threat handling
 * (both its own defensive detection and its own multi-line offense
 * construction), per the boss-tuning design's diagonal de-weighting knob.
 *
 * {@code horizontalDisabled} (2026-07-10 全對弈階梯設計 §4.1, L3-only "不可橫向"
 * twist): when true, direction index 0 (HORIZONTAL, {row fixed, col varies})
 * is skipped ENTIRELY — it contributes to none of five/openFour/closedFour/
 * openThree/doubleThreat/longestRun/diagonalContributesThreat. This is a
 * decision-table concern (steers {@link BossAiPolicy} and the test-only
 * player policies away from wasting a turn on an unwinnable horizontal
 * threat); the ACTUAL win judgement for a placed stone lives in
 * {@link PveLineScanner} (see {@code PveChallengeService#hasWinningLine}),
 * which independently also excludes HORIZONTAL lines on sequence 3.
 */
public final class PveDuelThreatScanner {

    private static final int[][] DIRECTIONS = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};
    private static final int HORIZONTAL_DIRECTION_INDEX = 0;
    private static final int FIRST_DIAGONAL_DIRECTION_INDEX = 2;

    public record Shape(boolean five, boolean openFour, boolean closedFour, boolean openThree,
                        boolean doubleThreat, int longestRun, boolean diagonalContributesThreat) {
    }

    /** An existing (already on the board) contiguous open three — see {@link #findExistingOpenThrees}. */
    public record ExistingOpenThree(int[] middle, int[] flankA, int[] flankB) {
    }

    private PveDuelThreatScanner() {
    }

    /** Evaluate the shape that would result from placing {@code color} at the given EMPTY cell (horizontalDisabled=false). */
    public static Shape evaluate(SeriousBoard board, int row, int col, StoneColor color) {
        return evaluate(board, row, col, color, false);
    }

    /** As {@link #evaluate(SeriousBoard, int, int, StoneColor)}, with the L3 "不可橫向" direction mask (§4.1). */
    public static Shape evaluate(SeriousBoard board, int row, int col, StoneColor color, boolean horizontalDisabled) {
        boolean five = false;
        boolean openFour = false;
        boolean closedFour = false;
        boolean openThree = false;
        int threatDirections = 0;
        int longestRun = 0;
        boolean diagonalContributesThreat = false;

        for (int dirIndex = 0; dirIndex < DIRECTIONS.length; dirIndex++) {
            if (horizontalDisabled && dirIndex == HORIZONTAL_DIRECTION_INDEX) {
                continue;
            }
            int[] d = DIRECTIONS[dirIndex];
            int forward = runLength(board, row, col, d[0], d[1], color);
            int backward = runLength(board, row, col, -d[0], -d[1], color);
            int run = 1 + forward + backward;
            longestRun = Math.max(longestRun, run);

            int fr = row + d[0] * (forward + 1);
            int fc = col + d[1] * (forward + 1);
            int br = row - d[0] * (backward + 1);
            int bc = col - d[1] * (backward + 1);
            int opens = (isOpen(board, fr, fc) ? 1 : 0) + (isOpen(board, br, bc) ? 1 : 0);

            if (run >= 5) {
                five = true;
            }
            boolean dirOpenFour = run == 4 && opens == 2;
            boolean dirClosedFour = run == 4 && opens == 1;
            boolean dirOpenThree = run == 3 && opens == 2;
            if (dirOpenFour) {
                openFour = true;
            }
            if (dirClosedFour) {
                closedFour = true;
            }
            if (dirOpenThree) {
                openThree = true;
            }
            if (dirOpenFour || dirClosedFour || dirOpenThree) {
                threatDirections++;
                if (dirIndex >= FIRST_DIAGONAL_DIRECTION_INDEX) {
                    diagonalContributesThreat = true;
                }
            }
        }
        return new Shape(five, openFour, closedFour, openThree, threatDirections >= 2, longestRun,
                diagonalContributesThreat);
    }

    /**
     * Scan for EXISTING contiguous open threes of {@code color} already on the
     * board (documents/PVE-全對弈階梯設計-2026-07-10.md §3.3 精準狙擊
     * PRECISION_SNIPE): a maximal run of exactly 3 stones with BOTH flanks
     * in-bounds/empty/non-obstacle. Returns the run's middle cell (the snipe
     * target) plus both flank cells, one entry per qualifying direction/run.
     */
    public static List<ExistingOpenThree> findExistingOpenThrees(SeriousBoard board, StoneColor color,
                                                                  boolean horizontalDisabled) {
        List<ExistingOpenThree> found = new ArrayList<>();
        int size = board.size();
        for (int dirIndex = 0; dirIndex < DIRECTIONS.length; dirIndex++) {
            if (horizontalDisabled && dirIndex == HORIZONTAL_DIRECTION_INDEX) {
                continue;
            }
            int[] d = DIRECTIONS[dirIndex];
            for (int r = 0; r < size; r++) {
                for (int c = 0; c < size; c++) {
                    if (board.stoneAt(r, c) != color) {
                        continue;
                    }
                    int pr = r - d[0];
                    int pc = c - d[1];
                    if (pr >= 0 && pr < size && pc >= 0 && pc < size && board.stoneAt(pr, pc) == color) {
                        continue; // not the head of the run
                    }
                    int len = 0;
                    int rr = r;
                    int cc = c;
                    while (rr >= 0 && rr < size && cc >= 0 && cc < size && board.stoneAt(rr, cc) == color) {
                        len++;
                        rr += d[0];
                        cc += d[1];
                    }
                    if (len != 3) {
                        continue;
                    }
                    int[] flankA = {r - d[0], c - d[1]};
                    int[] flankB = {r + d[0] * 3, c + d[1] * 3};
                    if (isOpen(board, flankA[0], flankA[1]) && isOpen(board, flankB[0], flankB[1])) {
                        int[] middle = {r + d[0], c + d[1]};
                        found.add(new ExistingOpenThree(middle, flankA, flankB));
                    }
                }
            }
        }
        return found;
    }

    private static int runLength(SeriousBoard board, int row, int col, int dr, int dc, StoneColor color) {
        int len = 0;
        int r = row + dr;
        int c = col + dc;
        while (board.inBounds(r, c) && board.stoneAt(r, c) == color) {
            len++;
            r += dr;
            c += dc;
        }
        return len;
    }

    private static boolean isOpen(SeriousBoard board, int row, int col) {
        return board.inBounds(row, col) && !board.isObstacle(row, col) && board.stoneAt(row, col) == null;
    }
}
