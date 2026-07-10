package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Test-only "trained player" reference policy for the DUEL win-rate statistic
 * (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §4.2): a player who has
 * already been through levels 1-7's classic-shape teaching curriculum knows
 * how to chain forcing four-moves (a bounded VCF search) into a double threat
 * or an outright five, and falls back to the same defend/extend heuristic
 * {@link BossAiPolicy} itself uses when no forcing sequence exists. This is
 * intentionally NOT a full-strength solver — it is meant to model "a
 * reasonably drilled human player," which is exactly the asymmetry (deep
 * intentional search vs the boss's non-search heuristic) the design's win
 * targets (L4>=70%, L8>=45%) are supposed to be won on.
 *
 * Move priority, every ply:
 *  1. own five (win immediately);
 *  2. block the opponent's already-formed four/five-threat (MUST, or lose);
 *  3. prevent the opponent forming an open four (MUST);
 *  4. a bounded VCF search: chain own closed-four moves (each one forces the
 *     opponent's single reply) until an outright five or an open four/double
 *     threat is reached — see {@link #searchForcedWin};
 *  5. own open four / own double threat (in case the VCF search's depth
 *     limit missed a 1-ply win that's ALSO not a "closed four" chain step);
 *  6. prevent the opponent forming an open three (defensive, unconditional —
 *     unlike the boss's own skip-chance, a trained human never skips this);
 *  7. extend the own longest line, preferring cells that also open a new
 *     threat, deterministically tie-broken toward the board center (no RNG
 *     needed here — this is a test harness, not a persisted game).
 */
public final class ReferencePlayerPolicy {

    private static final int MAX_VCF_DEPTH = 12;

    private ReferencePlayerPolicy() {
    }

    public static int[] nextMove(SeriousBoard board, StoneColor color, boolean horizontalDisabled) {
        StoneColor opponent = color.opposite();
        List<int[]> candidates = PveDuelCandidates.cells(board);
        if (candidates.isEmpty()) {
            return PveDuelCandidates.centerOrNearestEmpty(board);
        }

        for (int[] c : candidates) {
            if (PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled).five()) {
                return c;
            }
        }
        List<int[]> blockFive = filter(board, candidates, opponent, PveDuelThreatScanner.Shape::five, horizontalDisabled);
        if (!blockFive.isEmpty()) {
            return pickCentered(blockFive);
        }
        List<int[]> preventOpenFour = filter(board, candidates, opponent, PveDuelThreatScanner.Shape::openFour, horizontalDisabled);
        if (!preventOpenFour.isEmpty()) {
            return pickCentered(preventOpenFour);
        }

        Deque<int[]> path = new ArrayDeque<>();
        if (searchForcedWin(board, color, MAX_VCF_DEPTH, path, horizontalDisabled)) {
            return path.peekFirst();
        }

        List<int[]> ownOpenFour = filter(board, candidates, color, PveDuelThreatScanner.Shape::openFour, horizontalDisabled);
        if (!ownOpenFour.isEmpty()) {
            return pickCentered(ownOpenFour);
        }
        List<int[]> ownDoubleThreat = filter(board, candidates, color, PveDuelThreatScanner.Shape::doubleThreat, horizontalDisabled);
        if (!ownDoubleThreat.isEmpty()) {
            return pickCentered(ownDoubleThreat);
        }
        List<int[]> preventOpenThree = filter(board, candidates, opponent, PveDuelThreatScanner.Shape::openThree, horizontalDisabled);
        if (!preventOpenThree.isEmpty()) {
            return pickCentered(preventOpenThree);
        }

        int bestScore = Integer.MIN_VALUE;
        for (int[] c : candidates) {
            bestScore = Math.max(bestScore, extendScore(board, c, color, horizontalDisabled));
        }
        List<int[]> topScored = new ArrayList<>();
        for (int[] c : candidates) {
            if (extendScore(board, c, color, horizontalDisabled) == bestScore) {
                topScored.add(c);
            }
        }
        return pickCentered(topScored);
    }

    private static int extendScore(SeriousBoard board, int[] c, StoneColor color, boolean horizontalDisabled) {
        PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled);
        boolean newThreat = shape.openFour() || shape.closedFour() || shape.openThree() || shape.doubleThreat();
        return (newThreat ? 100 : 0) + shape.longestRun();
    }

    /**
     * Bounded VCF search (§4.2): try every candidate that creates an
     * immediate five (terminal success) or an open four (terminal success —
     * the opponent's mandatory single-gap block per BossAiPolicy layer 2
     * can only cover one of the open four's two flanks); otherwise try every
     * candidate that creates a CLOSED four, deterministically simulate the
     * opponent's forced single-gap reply, and recurse one ply deeper. Mutates
     * {@code board} temporarily (fully undone before returning).
     */
    private static boolean searchForcedWin(SeriousBoard board, StoneColor color, int depth, Deque<int[]> path,
                                           boolean horizontalDisabled) {
        if (depth <= 0) {
            return false;
        }
        List<int[]> candidates = PveDuelCandidates.cells(board);

        for (int[] c : candidates) {
            if (PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled).five()) {
                path.addLast(c);
                return true;
            }
        }
        for (int[] c : candidates) {
            PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled);
            if (shape.openFour() || shape.doubleThreat()) {
                path.addLast(c);
                return true;
            }
        }
        for (int[] c : candidates) {
            if (!PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled).closedFour()) {
                continue;
            }
            board.setStone(c[0], c[1], color);
            int[] gap = findClosedFourGap(board, c[0], c[1], color);
            boolean success = false;
            if (gap != null && board.isEmptyPlayable(gap[0], gap[1])) {
                board.setStone(gap[0], gap[1], color.opposite());
                path.addLast(c);
                success = searchForcedWin(board, color, depth - 1, path, horizontalDisabled);
                if (!success) {
                    path.removeLast();
                }
                board.removeStone(gap[0], gap[1]);
            }
            board.removeStone(c[0], c[1]);
            if (success) {
                return true;
            }
        }
        // VCT-lite (2026-07-09 實作校準): a pure VCF search (fours only) stalls
        // against a perfect single-threat blocker (BossAiPolicy's layers 2/3
        // unconditionally deny every four/open-four) — real forcing chains
        // routinely also include OPEN-THREE moves the opponent is heavily
        // pressured to answer (TRUE_DEMON/L8 always does per its layer 6; even
        // APPRENTICE/L4 does 80% of the time). Assume one flank gets blocked
        // (the nearer-to-center one, a stable deterministic pick) and recurse;
        // if that assumption turns out wrong in the REAL game (L4's 20% skip),
        // the caller simply re-runs this search fresh next real turn with an
        // even more favorable actual position, so an inaccurate assumption
        // here is never harmful, only occasionally overly pessimistic.
        for (int[] c : candidates) {
            if (!PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled).openThree()) {
                continue;
            }
            board.setStone(c[0], c[1], color);
            int[] block = nearestOpenThreeFlank(board, c[0], c[1], color);
            boolean success = false;
            if (block != null && board.isEmptyPlayable(block[0], block[1])) {
                board.setStone(block[0], block[1], color.opposite());
                path.addLast(c);
                success = searchForcedWin(board, color, depth - 1, path, horizontalDisabled);
                if (!success) {
                    path.removeLast();
                }
                board.removeStone(block[0], block[1]);
            }
            board.removeStone(c[0], c[1]);
            if (success) {
                return true;
            }
        }
        return false;
    }

    /** After placing {@code color} at (row,col) forming an open three, the flank nearer the board center (deterministic assumed block). */
    private static int[] nearestOpenThreeFlank(SeriousBoard board, int row, int col, StoneColor color) {
        int[][] dirs = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};
        int center = PveFieldGeometry.BOARD_SIZE / 2;
        int[] best = null;
        int bestDist = Integer.MAX_VALUE;
        for (int[] d : dirs) {
            int forward = runLength(board, row, col, d[0], d[1], color);
            int backward = runLength(board, row, col, -d[0], -d[1], color);
            int run = 1 + forward + backward;
            if (run != 3) {
                continue;
            }
            int fr = row + d[0] * (forward + 1);
            int fc = col + d[1] * (forward + 1);
            int br = row - d[0] * (backward + 1);
            int bc = col - d[1] * (backward + 1);
            if (!isOpen(board, fr, fc) || !isOpen(board, br, bc)) {
                continue; // not actually an open three in this direction
            }
            for (int[] flank : new int[][]{{fr, fc}, {br, bc}}) {
                int dist = Math.max(Math.abs(flank[0] - center), Math.abs(flank[1] - center));
                if (dist < bestDist) {
                    bestDist = dist;
                    best = flank;
                }
            }
        }
        return best;
    }

    /** After placing {@code color} at (row,col), the single open flank of whichever direction became a closed four. */
    private static int[] findClosedFourGap(SeriousBoard board, int row, int col, StoneColor color) {
        int[][] dirs = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};
        for (int[] d : dirs) {
            int forward = runLength(board, row, col, d[0], d[1], color);
            int backward = runLength(board, row, col, -d[0], -d[1], color);
            int run = 1 + forward + backward;
            if (run != 4) {
                continue;
            }
            int fr = row + d[0] * (forward + 1);
            int fc = col + d[1] * (forward + 1);
            int br = row - d[0] * (backward + 1);
            int bc = col - d[1] * (backward + 1);
            boolean forwardOpen = isOpen(board, fr, fc);
            boolean backwardOpen = isOpen(board, br, bc);
            if (forwardOpen && !backwardOpen) {
                return new int[]{fr, fc};
            }
            if (backwardOpen && !forwardOpen) {
                return new int[]{br, bc};
            }
        }
        return null;
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

    private static List<int[]> filter(SeriousBoard board, List<int[]> candidates, StoneColor color,
                                      java.util.function.Predicate<PveDuelThreatScanner.Shape> predicate,
                                      boolean horizontalDisabled) {
        List<int[]> matched = new ArrayList<>();
        for (int[] c : candidates) {
            if (predicate.test(PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled))) {
                matched.add(c);
            }
        }
        return matched;
    }

    private static int[] pickCentered(List<int[]> matches) {
        int[] best = matches.get(0);
        int bestDist = chebyshevToCenter(best);
        for (int[] c : matches) {
            int dist = chebyshevToCenter(c);
            if (dist < bestDist) {
                best = c;
                bestDist = dist;
            }
        }
        return best;
    }

    private static int chebyshevToCenter(int[] cell) {
        int center = PveFieldGeometry.BOARD_SIZE / 2;
        return Math.max(Math.abs(cell[0] - center), Math.abs(cell[1] - center));
    }
}
