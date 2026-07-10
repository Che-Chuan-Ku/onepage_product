package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;

import java.util.ArrayList;
import java.util.List;

/**
 * Test-only "ordinary player" reference policy for the DUEL win-rate
 * statistic (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §6.4 "普通玩家"
 * statistical baseline): unlike {@link ReferencePlayerPolicy} (a player who
 * has been through the levels 1-7 classic-shape curriculum and can chain a
 * bounded VCF/VCT-lite forcing search), this models a genuinely average
 * player who only knows the basics — block the boss's already-formed
 * four/five, extend their own longest line, and opportunistically complete a
 * simple rush-four when one is sitting right there. No VCT double-threat
 * search, no VCF forced-sequence search, and — deliberately, to mirror the
 * L4 boss's own new limitation (§6.4 (a)) — no "prevent the opponent's open
 * four from forming" foresight either: an ordinary player reacts to threats
 * that are already fully formed, not ones that are merely about to form.
 *
 * This is the correct yardstick for what "見習" (apprentice-level boss)
 * actually means: L4 should beat THIS player convincingly (design target
 * >=60%), while still losing badly to {@link ReferencePlayerPolicy}'s
 * deliberate forcing search (design target: reference player wins
 * ~100% against L4).
 *
 * Move priority, every ply:
 *  1. own five (win immediately);
 *  2. block the opponent's already-formed four/five-threat (MUST, or lose
 *     outright next opponent turn) — the one defensive reflex every player,
 *     however inexperienced, has;
 *  3. own open four (an unstoppable win-in-progress — any player takes this);
 *  4. own closed four ("簡單衝四" — a naive, one-ply-deep offensive reflex:
 *     grab a rush-four completion whenever one is immediately available, with
 *     no deeper forcing-chain planning behind it);
 *  5. extend the own longest line, preferring cells that also open a new
 *     threat, deterministically tie-broken toward the board center (same
 *     scoring shape as {@link BossAiPolicy}'s own layer 7 and
 *     {@link ReferencePlayerPolicy}'s fallback — this is the one piece of
 *     "extend toward a five" instinct every player shares).
 */
public final class OrdinaryPlayerPolicy {

    private OrdinaryPlayerPolicy() {
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

        List<int[]> ownOpenFour = filter(board, candidates, color, PveDuelThreatScanner.Shape::openFour, horizontalDisabled);
        if (!ownOpenFour.isEmpty()) {
            return pickCentered(ownOpenFour);
        }
        List<int[]> ownClosedFour = filter(board, candidates, color, PveDuelThreatScanner.Shape::closedFour, horizontalDisabled);
        if (!ownClosedFour.isEmpty()) {
            return pickCentered(ownClosedFour);
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
