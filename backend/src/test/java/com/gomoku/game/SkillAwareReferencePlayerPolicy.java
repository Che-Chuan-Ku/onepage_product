package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;

import java.util.List;

/**
 * L8 "反技能" statistical reference player (documents/PVE-全對弈階梯設計-2026-07-10.md
 * §7.3 誠實聲明 — task instruction explicitly requires this be BUILT, not
 * deferred as the source design doc's own §7.3 draft had proposed): the plain
 * {@link ReferencePlayerPolicy} is blind to the SKILL_DEMON boss's 3 one-shot
 * skills (PRECISION_SNIPE / SCATTER_SHOT / PIONEER_STAR, see
 * {@link BossAiPolicy#nextAction}) — it never anticipates that an already-
 * formed open three could be sniped-and-split, or that a dense own-stone
 * cluster could be swept by an opening-star cast.
 *
 * This policy layers ONE concrete precaution on top of {@link
 * ReferencePlayerPolicy}'s own forcing-search play: whenever there is no more
 * urgent tactical necessity (an immediate own-five, a MUST-block of the
 * opponent's already-formed four, or a MUST-prevent of the opponent's about-
 * to-form open four), and the player already has an EXISTING open three on
 * the board (a genuine 3-in-a-row with both flanks open — the exact shape
 * {@link BossAiPolicy}'s ⑥前 PRECISION_SNIPE insertion point targets), it
 * upgrades that three into a four immediately by taking one of its two open
 * flanks — a four is no longer vulnerable to the snipe-and-split trick the
 * way a bare open three is (splitting the MIDDLE stone of a three destroys
 * the whole line; splitting one END stone of a four still leaves 3
 * contiguous stones plus an isolated single, a far smaller tactical loss).
 * This directly negates the snipe threat instead of playing blind to it.
 *
 * Explicitly out of scope for this pass (see the design doc's own §7.3
 * admission that a fully rigorous anti-skill player is a deeper research
 * problem than one implementation pass can close): PIONEER_STAR-aware stone
 * spacing (deliberately avoiding dense clusters a sweep could net-clear) and
 * SCATTER_SHOT counter-play. The one precaution implemented here is the
 * highest-value, most mechanically precise one available (§3.3's snipe
 * heuristic has an exact, deterministic trigger condition to defend against);
 * L8's statistics should be read as "a materially more skill-aware
 * measurement than the plain ReferencePlayerPolicy", not as a claim of a
 * perfect anti-skill solver.
 */
public final class SkillAwareReferencePlayerPolicy {

    private SkillAwareReferencePlayerPolicy() {
    }

    public static int[] nextMove(SeriousBoard board, StoneColor color, boolean horizontalDisabled) {
        StoneColor opponent = color.opposite();
        List<int[]> candidates = PveDuelCandidates.cells(board);
        if (candidates.isEmpty()) {
            return PveDuelCandidates.centerOrNearestEmpty(board);
        }

        boolean urgentElsewhere = candidates.stream().anyMatch(c ->
                PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled).five())
                || candidates.stream().anyMatch(c ->
                        PveDuelThreatScanner.evaluate(board, c[0], c[1], opponent, horizontalDisabled).five())
                || candidates.stream().anyMatch(c ->
                        PveDuelThreatScanner.evaluate(board, c[0], c[1], opponent, horizontalDisabled).openFour());

        if (!urgentElsewhere) {
            for (PveDuelThreatScanner.ExistingOpenThree three
                    : PveDuelThreatScanner.findExistingOpenThrees(board, color, horizontalDisabled)) {
                for (int[] flank : new int[][]{three.flankA(), three.flankB()}) {
                    if (containsCell(candidates, flank)) {
                        return flank;
                    }
                }
            }
        }

        return ReferencePlayerPolicy.nextMove(board, color, horizontalDisabled);
    }

    private static boolean containsCell(List<int[]> cells, int[] target) {
        for (int[] c : cells) {
            if (c[0] == target[0] && c[1] == target[1]) {
                return true;
            }
        }
        return false;
    }
}
