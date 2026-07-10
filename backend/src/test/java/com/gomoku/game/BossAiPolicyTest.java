package com.gomoku.game;

import com.gomoku.domain.enums.PveOpeningScript;
import com.gomoku.domain.enums.StoneColor;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;

/**
 * Unit coverage for {@link BossAiPolicy}'s priority-layer decision table
 * (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §4.3 "Boss AI 單元案例",
 * L4 見習魔王 nerf cases added §6.4 2026-07-09 emergency tuning). Pure — no
 * Spring context, no DB — every board is hand-constructed with
 * {@link SeriousBoard} directly.
 */
class BossAiPolicyTest {

    private static final String SEED = "boss-ai-unit-test-seed";

    // ────────────────────────── 必擋衝四 (layer 2) ─────────────────────────────

    @Test
    void trueDemonAlwaysBlocksAnAlreadyFormedClosedFour() {
        SeriousBoard board = closedFourBoard();
        for (int i = 1; i <= 200; i++) {
            int[] move = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.TRUE_DEMON, SEED, 8, i, false);
            Assertions.assertThat(move).as("TRUE_DEMON must always block the single completing gap (sample %d)", i)
                    .isEqualTo(new int[]{5, 6});
        }
    }

    /**
     * 致命骰禁令 (§7.6 2026-07-10): the old 5% APPRENTICE "手滑" dice on this
     * layer were removed — an already-formed four is a LETHAL situation, so
     * EVERY tier must block its completing gap unconditionally. This replaces
     * the former 2-8% slip-rate sampling test.
     */
    @Test
    void everyProfileAlwaysBlocksAnAlreadyFormedClosedFour_noSlipDice() {
        SeriousBoard board = closedFourBoard();
        for (BossAiPolicy.Profile profile : BossAiPolicy.Profile.values()) {
            for (int i = 1; i <= 200; i++) {
                int[] move = BossAiPolicy.nextMove(board, profile, SEED, 4, i, false);
                Assertions.assertThat(move)
                        .as("%s must always block the single completing gap (sample %d) — lethal, no dice", profile, i)
                        .isEqualTo(new int[]{5, 6});
            }
        }
    }

    /** Player (BLACK) closed four: (5,2)-(5,3)-(5,4)-(5,5), left flank (5,1) blocked so the ONLY completing gap is (5,6). */
    private SeriousBoard closedFourBoard() {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        board.setObstacle(5, 1);
        for (int c = 2; c <= 5; c++) {
            board.setStone(5, c, StoneColor.BLACK);
        }
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 5, 6, StoneColor.BLACK).five())
                .as("sanity: (5,6) must complete the player's five").isTrue();
        return board;
    }

    // ────────────────────────── 必擋活四萌芽 (layer 3, 致命骰禁令 §7.6) ─────────

    /**
     * 致命骰禁令 (§7.6 2026-07-10): a player open three about to become an
     * open four IS a lethal situation — layer 3 is now an unconditional MUST
     * for EVERY tier (the old preventOpenFourChance dice — 0%/8%/55%/100% —
     * were removed). This replaces both the old "TRUE_DEMON always /
     * APPRENTICE 8%" pair and the 5-11% sampling test. The WHITE decoy
     * open-two keeps layer 7's greedy fallback from ever coincidentally
     * landing on the flank cells, so any observed flank block is genuinely
     * layer 3 (same isolation technique the old sampling test used).
     */
    @Test
    void everyProfileAlwaysPreventsPlayerFormingAnOpenFour_noDice() {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        // Player (BLACK) open three (5,5)-(5,6)-(5,7), both flanks (5,4)/(5,8) open —
        // playing EITHER flank would make an open four; the boss must occupy one.
        for (int c = 5; c <= 7; c++) {
            board.setStone(5, c, StoneColor.BLACK);
        }
        board.setStone(9, 7, StoneColor.WHITE);
        board.setStone(9, 8, StoneColor.WHITE);
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 5, 4, StoneColor.BLACK).openFour()).isTrue();
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 5, 8, StoneColor.BLACK).openFour()).isTrue();

        for (BossAiPolicy.Profile profile : BossAiPolicy.Profile.values()) {
            for (int i = 1; i <= 200; i++) {
                int[] move = BossAiPolicy.nextMove(board, profile, SEED, 4, i, false);
                boolean blocked = (move[0] == 5 && move[1] == 4) || (move[0] == 5 && move[1] == 8);
                Assertions.assertThat(blocked)
                        .as("%s must occupy an open-four-forming flank (sample %d), got %s — lethal, no dice",
                                profile, i, java.util.Arrays.toString(move))
                        .isTrue();
            }
        }
    }

    // ────────────────────────── 必成五 (layer 1, both profiles, unconditional) ──

    @Test
    void alwaysTakesItsOwnWinningMove_bothProfiles() {
        for (BossAiPolicy.Profile profile : BossAiPolicy.Profile.values()) {
            SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
            // Boss (WHITE) has an open four (3,3)-(3,6) — BOTH (3,2) and (3,7)
            // independently complete it to five; either is an acceptable
            // layer-1 pick, so assert on the resulting SHAPE, not a fixed cell.
            for (int c = 3; c <= 6; c++) {
                board.setStone(3, c, StoneColor.WHITE);
            }
            Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 3, 2, StoneColor.WHITE).five()).isTrue();
            Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 3, 7, StoneColor.WHITE).five()).isTrue();

            int[] move = BossAiPolicy.nextMove(board, profile, SEED, 1, 1, false);
            Assertions.assertThat(PveDuelThreatScanner.evaluate(board, move[0], move[1], StoneColor.WHITE).five())
                    .as("%s must take a move that completes its own five, got %s", profile, java.util.Arrays.toString(move))
                    .isTrue();
        }
    }

    // ────────────────────────── L4 確實會漏擋活三 (層6, 17-27%機率，2026-07-09先提升至45%
    // 又因與層3移除的複合效應校準回22% — 見 BossAiPolicy.Profile javadoc 與設計文件§6.4) ──

    /**
     * §7.6 rewrite: sampled via the {@link BossAiPolicy.MoveAudit} skip flag
     * instead of move position — the new layer-7a extend dither (also RNG-
     * driven) can coincidentally land its harmless near-center pick ON a
     * block flank after a genuine skip, so position no longer identifies the
     * layer-6 dice outcome; the audit flag does, exactly (it is what the §7.6
     * 統計可稽核 fields persist).
     */
    @Test
    void apprenticeSkipsBlockingOpenThreeFormationWithin17To27Percent() {
        SeriousBoard board = openTwoOnlyBoard();
        int samples = 1000;
        int skipped = 0;
        for (int i = 1; i <= samples; i++) {
            BossAiPolicy.Decision decision = BossAiPolicy.decideMove(
                    board, BossAiPolicy.Profile.APPRENTICE, SEED, 4, i, false, false, false);
            Assertions.assertThat(decision.audit().facedOpenThree()).as("sample %d", i).isTrue();
            if (decision.audit().openThreeSkipRolled()) {
                skipped++;
            } else {
                boolean blocked = (decision.move()[0] == 5 && decision.move()[1] == 4)
                        || (decision.move()[0] == 5 && decision.move()[1] == 7);
                Assertions.assertThat(blocked)
                        .as("un-skipped layer 6 must actually place the block (sample %d)", i).isTrue();
            }
        }
        double skipRatePercent = 100.0 * skipped / samples;
        Assertions.assertThat(skipRatePercent)
                .as("APPRENTICE open-three-formation skip rate over %d samples", samples)
                .isBetween(17.0, 27.0);
    }

    /**
     * §6.4 (d) "斜線方向的威脅偵測對 L4 降權": when the open-three threat is
     * diagonal-only, APPRENTICE's skip chance is boosted further
     * (22%+8%=30%) — sampled the same way as the orthogonal case above but
     * on a diagonal open-two board, expecting a materially higher skip rate.
     */
    /** §7.6 rewrite: audit-flag sampling, same reasoning as the orthogonal case above. */
    @Test
    void apprenticeSkipsDiagonalOpenThreeFormationMoreOftenThanOrthogonal_within23To37Percent() {
        SeriousBoard board = diagonalOpenTwoOnlyBoard();
        int samples = 1000;
        int skipped = 0;
        for (int i = 1; i <= samples; i++) {
            BossAiPolicy.Decision decision = BossAiPolicy.decideMove(
                    board, BossAiPolicy.Profile.APPRENTICE, SEED, 4, i, false, false, false);
            if (decision.audit().openThreeSkipRolled()) {
                skipped++;
            }
        }
        double skipRatePercent = 100.0 * skipped / samples;
        Assertions.assertThat(skipRatePercent)
                .as("APPRENTICE diagonal open-three-formation skip rate over %d samples", samples)
                .isBetween(23.0, 37.0);
    }

    // ────────────────────────── L8 從不漏擋活三 ────────────────────────────────

    @Test
    void trueDemonNeverSkipsBlockingOpenThreeFormation() {
        SeriousBoard board = openTwoOnlyBoard();
        for (int i = 1; i <= 200; i++) {
            int[] move = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.TRUE_DEMON, SEED, 8, i, false);
            boolean blocked = (move[0] == 5 && move[1] == 4) || (move[0] == 5 && move[1] == 7);
            Assertions.assertThat(blocked).as("TRUE_DEMON must always prevent the open-three formation (sample %d)", i).isTrue();
        }
    }

    /**
     * A lone player (BLACK) "open two" (5,5)-(5,6), both flanks open — layer
     * 6's actual trigger (§1.2 威脅分類: 活三 = a HYPOTHETICAL placement's
     * resulting run==3/opens==2, i.e. "if BLACK plays here, an open three
     * would result" — NOT an already-existing open three on the board, which
     * is layer 3's domain instead: an existing open three's flank-fill would
     * already produce run==4/opens==2, an open FOUR, caught earlier and
     * unconditionally). Playing either (5,4) or (5,7) creates a fresh open
     * three; no other layer is reachable on this otherwise-empty board.
     *
     * A single decoy WHITE stone far away at (9,9) keeps layer 7's "extend
     * own line" fallback (reached whenever layer 6 actually skips) from
     * EVER coincidentally landing back on (5,4)/(5,7) — without it, WHITE
     * has no stones anywhere, so every candidate ties at layer 7's minimum
     * score and the near-center block cells are frequently among the
     * randomly-chosen top-K pool purely by chance, which would silently
     * deflate the measured skip rate (a "block" that only happened by
     * accident via a completely different layer looks identical to a real
     * layer-6 block from the outside). The decoy gives WHITE a strictly
     * higher-scoring extension target elsewhere, so layer 7 never touches
     * the block cells at all — every non-block move observed below is
     * unambiguously a genuine layer-6 skip.
     */
    private SeriousBoard openTwoOnlyBoard() {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        board.setStone(5, 5, StoneColor.BLACK);
        board.setStone(5, 6, StoneColor.BLACK);
        board.setStone(9, 9, StoneColor.WHITE);
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 5, 4, StoneColor.BLACK).openThree()).isTrue();
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 5, 7, StoneColor.BLACK).openThree()).isTrue();
        return board;
    }

    // ────────────────────────── L1 NOVICE 腳本化教學漏擋 + 稽核旗標 (§7.6) ──────

    /**
     * §7.6 L1 NOVICE teaching beat: while the caller passes
     * {@code teachingForceBlock=true} (persisted faced-open-three count still
     * below {@link BossAiPolicy#NOVICE_TEACHING_FORCED_BLOCKS}), the 45%
     * leniency dice are suppressed — the boss MUST block, and the audit
     * carries both flags the persistence/teaching counter relies on.
     */
    @Test
    void noviceTeachingForceBlockAlwaysBlocksAndAuditsTheForcedBlock() {
        SeriousBoard board = openTwoOnlyBoard();
        for (int i = 1; i <= 200; i++) {
            BossAiPolicy.Decision decision = BossAiPolicy.decideMove(
                    board, BossAiPolicy.Profile.NOVICE, SEED, 1, i, false, false, true);
            boolean blocked = (decision.move()[0] == 5 && decision.move()[1] == 4)
                    || (decision.move()[0] == 5 && decision.move()[1] == 7);
            Assertions.assertThat(blocked)
                    .as("teaching-forced NOVICE must block the open-three formation (sample %d)", i).isTrue();
            Assertions.assertThat(decision.audit().facedOpenThree()).isTrue();
            Assertions.assertThat(decision.audit().teachingForcedBlock()).isTrue();
            Assertions.assertThat(decision.audit().openThreeSkipRolled()).isFalse();
        }
    }

    /**
     * §7.6: once teaching is over ({@code teachingForceBlock=false}) NOVICE's
     * 70% skip dice apply (致命骰禁令 compensation value, see Profile javadoc),
     * and the audit tells the two outcomes apart — skipped moves carry
     * {@code openThreeSkipRolled}, blocked ones don't; both carry
     * {@code facedOpenThree} (the teaching counter's signal).
     */
    @Test
    void noviceAfterTeachingSkipsAroundItsKnobAndAuditsEachOutcome() {
        SeriousBoard board = openTwoOnlyBoard();
        int samples = 1000;
        int skipped = 0;
        for (int i = 1; i <= samples; i++) {
            BossAiPolicy.Decision decision = BossAiPolicy.decideMove(
                    board, BossAiPolicy.Profile.NOVICE, SEED, 1, i, false, false, false);
            Assertions.assertThat(decision.audit().facedOpenThree()).as("sample %d", i).isTrue();
            Assertions.assertThat(decision.audit().teachingForcedBlock()).as("sample %d", i).isFalse();
            if (decision.audit().openThreeSkipRolled()) {
                skipped++;
            } else {
                // Un-skipped layer 6 must actually place the block; the
                // reverse implication doesn't hold positionally — after a
                // genuine skip, layer 7a's dither may coincidentally land on
                // a flank cell (see the APPRENTICE audit-sampling test).
                boolean blocked = (decision.move()[0] == 5 && decision.move()[1] == 4)
                        || (decision.move()[0] == 5 && decision.move()[1] == 7);
                Assertions.assertThat(blocked)
                        .as("un-skipped layer 6 must place the block (sample %d)", i).isTrue();
            }
        }
        double skipRatePercent = 100.0 * skipped / samples;
        double knobPercent = 100.0 * BossAiPolicy.Profile.NOVICE.skipOpenThreeChance();
        Assertions.assertThat(skipRatePercent)
                .as("NOVICE post-teaching open-three skip rate over %d samples (knob=%.0f%%)", samples, knobPercent)
                .isBetween(knobPercent - 6.0, knobPercent + 6.0);
    }

    /** Diagonal analogue of {@link #openTwoOnlyBoard()}: BLACK (5,5)-(6,6), flanks (4,4)/(7,7) both open; same WHITE decoy at (9,9). */
    private SeriousBoard diagonalOpenTwoOnlyBoard() {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        board.setStone(5, 5, StoneColor.BLACK);
        board.setStone(6, 6, StoneColor.BLACK);
        board.setStone(9, 9, StoneColor.WHITE);
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 4, 4, StoneColor.BLACK).openThree()).isTrue();
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 4, 4, StoneColor.BLACK).diagonalContributesThreat()).isTrue();
        Assertions.assertThat(PveDuelThreatScanner.evaluate(board, 7, 7, StoneColor.BLACK).openThree()).isTrue();
        return board;
    }

    // ────────────────────────── L8 會做雙威脅、L4 不會 (層5) ───────────────────

    @Test
    void trueDemonTakesDoubleThreat_apprenticeNever() {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        // Boss (WHITE) two perpendicular CLOSED threes meeting at (5,5): each
        // has its far flank pre-blocked so ONLY playing (5,5) forms a four
        // (closed, opens==1) in either direction — a genuine double threat
        // that neither triggers layer 1 (no five) nor layer 4 (neither
        // direction is an OPEN four) — isolating layer 5.
        board.setObstacle(5, 1);
        board.setStone(5, 2, StoneColor.WHITE);
        board.setStone(5, 3, StoneColor.WHITE);
        board.setStone(5, 4, StoneColor.WHITE);
        board.setObstacle(1, 5);
        board.setStone(2, 5, StoneColor.WHITE);
        board.setStone(3, 5, StoneColor.WHITE);
        board.setStone(4, 5, StoneColor.WHITE);

        PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, 5, 5, StoneColor.WHITE);
        Assertions.assertThat(shape.five()).as("sanity: not a five").isFalse();
        Assertions.assertThat(shape.openFour()).as("sanity: neither direction is an open four").isFalse();
        Assertions.assertThat(shape.doubleThreat()).as("sanity: (5,5) must be a genuine double threat").isTrue();

        int[] demonMove = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.TRUE_DEMON, SEED, 8, 1, false);
        Assertions.assertThat(demonMove).as("TRUE_DEMON must take the double-threat move").isEqualTo(new int[]{5, 5});

        // APPRENTICE (L4) never even EVALUATES layer 5 (§1.3 使用者裁決: L4
        // "永遠跳過此優先層") — asserted directly on the profile, since layer 7's
        // own "extend own line" greedy scoring can independently arrive at the
        // very same cell for an unrelated reason (it also happens to be the
        // longest-run extension available here), which would make a purely
        // behavioral "L4 must avoid this cell" assertion fragile/misleading.
        Assertions.assertThat(BossAiPolicy.Profile.APPRENTICE.doubleThreatChance()).isEqualTo(0.0);
        Assertions.assertThat(BossAiPolicy.Profile.TRUE_DEMON.doubleThreatChance()).isEqualTo(1.0);
    }

    /**
     * §6.4 (d) "見習魔王自己的進攻也應該少用斜線雙線牽制": a diagonal analogue
     * of the double-threat case above (one closed three horizontal, one
     * closed three DIAGONAL, meeting at (5,5)) — TRUE_DEMON always takes the
     * intersection via layer 5 as before; APPRENTICE (layer 5 skipped, so it
     * falls through to layer 7's greedy scoring, which would otherwise still
     * land on (5,5) since it's also the single highest-longestRun cell) now
     * has a ~30% chance to walk away from (5,5) entirely instead.
     */
    @Test
    void apprenticeSometimesAvoidsDiagonalDoubleThreatConstruction_within20To40Percent() {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        board.setObstacle(5, 1);
        board.setStone(5, 2, StoneColor.WHITE);
        board.setStone(5, 3, StoneColor.WHITE);
        board.setStone(5, 4, StoneColor.WHITE);
        board.setObstacle(1, 1);
        board.setStone(2, 2, StoneColor.WHITE);
        board.setStone(3, 3, StoneColor.WHITE);
        board.setStone(4, 4, StoneColor.WHITE);

        PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, 5, 5, StoneColor.WHITE);
        Assertions.assertThat(shape.doubleThreat()).as("sanity: (5,5) must be a genuine double threat").isTrue();
        Assertions.assertThat(shape.diagonalContributesThreat())
                .as("sanity: one of the two threat directions must be diagonal").isTrue();

        for (int i = 1; i <= 200; i++) {
            int[] demonMove = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.TRUE_DEMON, SEED, 8, i, false);
            Assertions.assertThat(demonMove).as("TRUE_DEMON must always take the double-threat move (sample %d)", i)
                    .isEqualTo(new int[]{5, 5});
        }

        int samples = 1000;
        int avoided = 0;
        for (int i = 1; i <= samples; i++) {
            int[] move = BossAiPolicy.nextMove(board, BossAiPolicy.Profile.APPRENTICE, SEED, 4, i, false);
            if (!(move[0] == 5 && move[1] == 5)) {
                avoided++;
            }
        }
        double avoidedRatePercent = 100.0 * avoided / samples;
        // §7.6: avoidance now compounds two independent non-lethal dice —
        // layer 7a extend dither (30%, always avoids the double-threat cell:
        // it only picks non-threat candidates) plus the original
        // singleLineOnly 30% on the non-dithered remainder:
        // 0.30 + 0.70 x 0.30 = 51% expected.
        Assertions.assertThat(avoidedRatePercent)
                .as("APPRENTICE diagonal-double-threat avoidance rate over %d samples", samples)
                .isBetween(44.0, 58.0);
    }

    // ────────────────────────── 開局腳本正確 (§1.4) ────────────────────────────

    @Test
    void openingScriptHuayueIsOrthogonalAdjacent() {
        Assertions.assertThat(BossAiPolicy.openingMove(PveOpeningScript.HUAYUE, 5, 5)).isEqualTo(new int[]{6, 5});
        Assertions.assertThat(BossAiPolicy.openingMove(PveOpeningScript.HUAYUE, 0, 0)).isEqualTo(new int[]{1, 0});
        // Row overflow (r=10, the last row) mirrors to r-1.
        Assertions.assertThat(BossAiPolicy.openingMove(PveOpeningScript.HUAYUE, 10, 3)).isEqualTo(new int[]{9, 3});
    }

    @Test
    void openingScriptPuyueIsDiagonalAdjacent() {
        Assertions.assertThat(BossAiPolicy.openingMove(PveOpeningScript.PUYUE, 5, 5)).isEqualTo(new int[]{6, 6});
        Assertions.assertThat(BossAiPolicy.openingMove(PveOpeningScript.PUYUE, 0, 0)).isEqualTo(new int[]{1, 1});
        // Each axis independently mirrors to -1 on its own overflow.
        Assertions.assertThat(BossAiPolicy.openingMove(PveOpeningScript.PUYUE, 10, 5)).isEqualTo(new int[]{9, 6});
        Assertions.assertThat(BossAiPolicy.openingMove(PveOpeningScript.PUYUE, 5, 10)).isEqualTo(new int[]{6, 9});
        Assertions.assertThat(BossAiPolicy.openingMove(PveOpeningScript.PUYUE, 10, 10)).isEqualTo(new int[]{9, 9});
    }

    @Test
    void profileForAndOpeningScriptForMatchSequenceAssignment() {
        // documents/PVE-全對弈階梯設計-2026-07-10.md §1/§9.1 八關階梯映射.
        Assertions.assertThat(BossAiPolicy.profileFor(1)).isEqualTo(BossAiPolicy.Profile.NOVICE);
        Assertions.assertThat(BossAiPolicy.profileFor(2)).isEqualTo(BossAiPolicy.Profile.APPRENTICE);
        Assertions.assertThat(BossAiPolicy.profileFor(3)).isEqualTo(BossAiPolicy.Profile.APPRENTICE);
        Assertions.assertThat(BossAiPolicy.profileFor(4)).isEqualTo(BossAiPolicy.Profile.ELITE);
        Assertions.assertThat(BossAiPolicy.profileFor(5)).isEqualTo(BossAiPolicy.Profile.ELITE);
        Assertions.assertThat(BossAiPolicy.profileFor(6)).isEqualTo(BossAiPolicy.Profile.ELITE);
        Assertions.assertThat(BossAiPolicy.profileFor(7)).isEqualTo(BossAiPolicy.Profile.TRUE_DEMON);
        Assertions.assertThat(BossAiPolicy.profileFor(8)).isEqualTo(BossAiPolicy.Profile.TRUE_DEMON);
        Assertions.assertThat(BossAiPolicy.openingScriptFor(2)).isEqualTo(PveOpeningScript.HUAYUE);
        Assertions.assertThat(BossAiPolicy.openingScriptFor(7)).isEqualTo(PveOpeningScript.PUYUE);
        Assertions.assertThat(BossAiPolicy.openingScriptFor(8)).isEqualTo(PveOpeningScript.PUYUE);
        Assertions.assertThat(BossAiPolicy.openingScriptFor(1)).isEqualTo(PveOpeningScript.NONE);
        Assertions.assertThat(BossAiPolicy.openingScriptFor(4)).isEqualTo(PveOpeningScript.NONE);
    }
}
