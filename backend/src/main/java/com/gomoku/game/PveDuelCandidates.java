package com.gomoku.game;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared candidate-cell pruning for DUEL move search (documents/PVE-魔王對弈
 * 與策略引導設計-2026-07-09.md §1.2 候選格剪枝): empty cells within Chebyshev
 * distance &lt;=2 of ANY existing stone — used by both {@link BossAiPolicy}
 * and the test-only reference player policy so the two share one definition
 * of "which moves are worth evaluating."
 */
public final class PveDuelCandidates {

    private PveDuelCandidates() {
    }

    /**
     * The board center if empty+playable, else the nearest empty/non-obstacle
     * cell (documents/PVE-全對弈階梯設計-2026-07-10.md §4.2: L5's one-time
     * static VOLCANO rocks can land ON the center cell for some seeds — the
     * "blank board" fallback every DUEL player-side policy uses must not
     * blindly return an obstructed center, or the very first move of the
     * game gets rejected by the API with "該格為障礙物，禁止落子").
     */
    public static int[] centerOrNearestEmpty(SeriousBoard board) {
        int center = PveFieldGeometry.BOARD_SIZE / 2;
        if (board.isEmptyPlayable(center, center)) {
            return new int[]{center, center};
        }
        for (int radius = 1; radius < PveFieldGeometry.BOARD_SIZE; radius++) {
            for (int dr = -radius; dr <= radius; dr++) {
                for (int dc = -radius; dc <= radius; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) != radius) {
                        continue;
                    }
                    int r = center + dr;
                    int c = center + dc;
                    if (board.inBounds(r, c) && board.isEmptyPlayable(r, c)) {
                        return new int[]{r, c};
                    }
                }
            }
        }
        throw new IllegalStateException("no empty playable cell found on an otherwise blank 11x11 board");
    }

    /** Empty cells within Chebyshev distance <=2 of any existing stone; empty list on a blank board. */
    public static List<int[]> cells(SeriousBoard board) {
        int size = board.size();
        boolean[][] occupied = new boolean[size][size];
        boolean any = false;
        for (int r = 0; r < size; r++) {
            for (int c = 0; c < size; c++) {
                if (board.hasStone(r, c)) {
                    occupied[r][c] = true;
                    any = true;
                }
            }
        }
        List<int[]> candidates = new ArrayList<>();
        if (!any) {
            return candidates; // caller falls back to the board center
        }
        boolean[][] seen = new boolean[size][size];
        for (int r = 0; r < size; r++) {
            for (int c = 0; c < size; c++) {
                if (!occupied[r][c]) {
                    continue;
                }
                for (int dr = -2; dr <= 2; dr++) {
                    for (int dc = -2; dc <= 2; dc++) {
                        int nr = r + dr;
                        int nc = c + dc;
                        if (nr < 0 || nr >= size || nc < 0 || nc >= size || seen[nr][nc]) {
                            continue;
                        }
                        seen[nr][nc] = true;
                        if (board.isEmptyPlayable(nr, nc)) {
                            candidates.add(new int[]{nr, nc});
                        }
                    }
                }
            }
        }
        if (candidates.isEmpty()) {
            // Extremely rare (a dense-but-not-full board where every cell
            // within Chebyshev<=2 of every existing stone happens to already
            // be occupied): widen to a full-board scan instead of leaving the
            // caller to fall back to the board center regardless of whether
            // it is actually empty — that fallback is ONLY safe for a truly
            // blank board (the `!any` branch above), never here, since
            // blindly overwriting an occupied center cell would silently
            // corrupt the board (observed during Boss對弈統計驗證.feature
            // calibration: long, poorly-resolving DUEL games occasionally hit
            // this and never converged to a real winner).
            for (int r = 0; r < size; r++) {
                for (int c = 0; c < size; c++) {
                    if (board.isEmptyPlayable(r, c)) {
                        candidates.add(new int[]{r, c});
                    }
                }
            }
        }
        return candidates;
    }
}
