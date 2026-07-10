package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;

/**
 * Unit coverage for the "狙擊閉四 combo" balance fix (game-design task item
 * #1, 2026-07-10): the player discovered that "make a closed four (boss
 * blocks the single gap) → PRECISION_SNIPE that exact boss stone back to
 * black → instant five" wins against EVERY AI tier, because layer 2's
 * mandatory block is unconditional across all {@link BossAiPolicy.Profile}
 * tiers, and PRECISION_SNIPE has no adjacency/recency constraint on its
 * target (any existing enemy stone qualifies — see
 * {@code PveChallengeService#executeSkill}'s PRECISION_SNIPE branch).
 *
 * <p>The fix (skillAwareDefense, TRUE_DEMON/SKILL_DEMON only — i.e. L7/L8,
 * NOVICE/APPRENTICE/ELITE never see it) intervenes ONE STAGE EARLIER: block
 * the candidate that would complete a CLOSED four (not just an open four) at
 * layer-3 priority, before the four ever forms, so even if the block itself
 * is later sniped, the result is a fresh four (needing one more move), never
 * an instant five.
 *
 * <p>Pure — no Spring context, no DB — mirrors {@link BossAiPolicyTest}'s
 * hand-constructed-board style.
 */
class BossAiPolicySkillAwareDefenseTest {

    private static final String SEED = "sniper-combo-fix-unit-test-seed";

    /**
     * The vulnerable stage: player has an EXISTING closed three — (5,0)-(5,2),
     * closed on the left by the board edge, open at (5,3) — and it is the
     * boss's turn. Playing WHITE at (5,3) is exactly the candidate that would
     * otherwise let BLACK complete a closed four next turn.
     */
    private SeriousBoard closedThreeBoard() {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        for (int c = 0; c <= 2; c++) {
            board.setStone(5, c, StoneColor.BLACK);
        }
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 5, 3, StoneColor.BLACK).closedFour())
                .as("sanity: (5,3) must be the closed-four-forming candidate").isTrue();
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 5, 3, StoneColor.BLACK).openFour())
                .as("sanity: (5,3) must NOT read as an open-four candidate (this is the closed-vs-open gap the fix closes)")
                .isFalse();
        return board;
    }

    @Test
    void withoutSkillAwareDefenseTrueDemonDoesNotPreemptivelyBlockAMereClosedThree() {
        SeriousBoard board = closedThreeBoard();
        for (int i = 1; i <= 50; i++) {
            int[] move = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.TRUE_DEMON, SEED, 7, i, false, false);
            Assertions.assertThat(move)
                    .as("sample %d: TRUE_DEMON without skillAwareDefense has no MUST-block reason to pick"
                            + " (5,3) specifically over its own offense/extension layers", i)
                    .isNotEqualTo(new int[]{5, 3});
        }
    }

    @Test
    void skillAwareDefenseMakesTrueDemonPreemptivelyBlockTheClosedThreesOpenFlank() {
        SeriousBoard board = closedThreeBoard();
        // Layer 3 is an unconditional MUST (致命骰禁令 §7.6) — the extended
        // predicate (openFour||closedFour) fires deterministically, no RNG
        // sampling needed.
        int[] move = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.TRUE_DEMON, SEED, 7, 1, false, true);
        Assertions.assertThat(move).isEqualTo(new int[]{5, 3});
    }

    /**
     * L1-L6 "不感知" (task decision): even if a caller mistakenly passed
     * skillAwareDefense=true for a non-TRUE_DEMON profile, behavior must not
     * change — since the 致命骰禁令 made layer 3 unconditional for every tier
     * (§7.6), the old "ELITE's own 55% knob keeps it probabilistic" second
     * line of defense is gone, so the policy now gates the closed-four
     * predicate widening INTERNALLY on {@code profile == TRUE_DEMON}
     * ({@code effectiveSkillAware}). A mere closed THREE is not lethal for a
     * snipe-less tier, so ELITE must never pre-block its open flank even when
     * the flag is (wrongly) passed.
     */
    @Test
    void eliteProfileNeverPreemptsAClosedThreeEvenIfFlagMistakenlyPassed() {
        SeriousBoard board = closedThreeBoard();
        // ELITE's layer-3 preventFour is openFour-only (effectiveSkillAware is
        // internally gated to TRUE_DEMON), so it can NEVER must-block the
        // closed-three flank (5,3) — a genuine layer-3 block would land there
        // ~100% of the time. ELITE's own §7.6 layer-7 extend dither (10%,
        // random) can, however, COINCIDENTALLY park a harmless stone on (5,3)
        // a small fraction of the time; that is not a skill-aware block. So
        // assert the rate stays far below any must-block signature rather than
        // an over-strict "never" that the random dither would flake on.
        int samples = 500;
        int landedOnFlank = 0;
        for (int i = 1; i <= samples; i++) {
            int[] move = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.ELITE, SEED, 4, i, false, true);
            if (move[0] == 5 && move[1] == 3) {
                landedOnFlank++;
            }
        }
        double flankRatePercent = 100.0 * landedOnFlank / samples;
        Assertions.assertThat(flankRatePercent)
                .as("ELITE must NOT must-block the closed-three flank (L1-L6 不感知, internal gate); "
                        + "only rare coincidental layer-7 dither may land there, %d/%d", landedOnFlank, samples)
                .isLessThan(15.0);
    }

    /**
     * End-to-end mechanics check, "before" half: once a closed four has
     * ALREADY formed (the player's own move, not the boss's), layer 2's
     * mandatory block is unconditional for every profile — confirming the
     * fix could NOT have worked by changing layer 2 itself; the block must
     * happen earlier (at the closed-three stage), which is exactly what
     * skillAwareDefense does.
     */
    @Test
    void onceAClosedFourAlreadyExistsLayer2sBlockIsUnconditionalAndStillSnipeable() {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        for (int c = 0; c <= 3; c++) {
            board.setStone(5, c, StoneColor.BLACK);
        }
        int[] move = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.TRUE_DEMON, SEED, 7, 5, false, true);
        Assertions.assertThat(move).as("layer 2 always blocks the single completing gap").isEqualTo(new int[]{5, 4});

        // Simulate the boss's mandatory block, then the player's snipe on that
        // exact stone (PRECISION_SNIPE: any existing enemy stone qualifies —
        // no adjacency/recency check in PveChallengeService#executeSkill).
        board.setStone(5, 4, StoneColor.WHITE);
        board.setStone(5, 4, StoneColor.BLACK); // the flip
        boolean nowFiveInARow = board.stoneAt(5, 0) == StoneColor.BLACK && board.stoneAt(5, 1) == StoneColor.BLACK
                && board.stoneAt(5, 2) == StoneColor.BLACK && board.stoneAt(5, 3) == StoneColor.BLACK
                && board.stoneAt(5, 4) == StoneColor.BLACK;
        Assertions.assertThat(nowFiveInARow)
                .as("the exploit's raw mechanism: flipping layer 2's own block completes an instant five")
                .isTrue();
    }

    /**
     * End-to-end mechanics check, "after" half: with skillAwareDefense
     * active, the boss's stone lands at the closed-three stage (still only 3
     * live stones), so flipping IT back only ever recreates a fresh four
     * (needing one more move) — never an instant five.
     */
    @Test
    void skillAwareDefensePreventsTheSnipeFromEverCompletingAnInstantFive() {
        SeriousBoard board = closedThreeBoard();
        int[] move = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.TRUE_DEMON, SEED, 7, 1, false, true);
        board.setStone(move[0], move[1], StoneColor.WHITE);

        // Player snipes the boss's pre-emptive block back to black.
        board.setStone(move[0], move[1], StoneColor.BLACK);

        boolean actuallyFive = board.stoneAt(5, 0) == StoneColor.BLACK && board.stoneAt(5, 1) == StoneColor.BLACK
                && board.stoneAt(5, 2) == StoneColor.BLACK && board.stoneAt(5, 3) == StoneColor.BLACK
                && board.stoneAt(5, 4) == StoneColor.BLACK;
        Assertions.assertThat(actuallyFive)
                .as("skillAwareDefense's pre-emptive block must not itself become the snipe-target that completes a five")
                .isFalse();
    }
}
