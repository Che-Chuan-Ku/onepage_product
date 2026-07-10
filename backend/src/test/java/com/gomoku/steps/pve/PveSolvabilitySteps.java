package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.enums.PveEncounterStatus;
import com.gomoku.game.PveFieldScheduler;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * "每關可解性" harness (specs/features/pve/關卡可解性.feature; documents/PVE-關卡
 * 重設計-2026-07-08.md acceptance): for every level x pool-template
 * combination, drive the SERVICE layer (via the same HTTP seam PveCommonSteps
 * already uses for every other PVE feature — see completeCurrentEncounterShapes,
 * shared with the generic "clear this encounter cheaply" helper used across
 * every other PVE feature) through the design doc's stated solution and
 * assert the boss dies within the move budget.
 *
 * completeCurrentEncounterShapes already handles the two real disruptions
 * inline: ABYSS (level 8) spawning a white obstacle on a target cell
 * (precision-snipe it, the design's own stated mitigation, §3) and RAGE
 * (level 6) clearing a shape's own already-placed stones before its line
 * completes (re-place any missing filled cell first, §4). Neither is
 * guaranteed collision-free for an arbitrary seed, so the whole attempt is
 * retried under a handful of candidate seeds (still constrained to the
 * wanted pool template) before failing for real.
 *
 * §5 D4 board transform (2026-07-08 rework): each scenario ALSO pins one of
 * the 8 {@link PveFieldScheduler.BoardTransform} slots (0..7, in enum
 * declaration order — see {@link PveFieldScheduler#transformIndexFor}), so
 * 關卡可解性.feature exhaustively covers all 8 levels x 2 templates x 8
 * transforms = 128 cases. For sequence 3 (ONE_EYE), transformFor() folds any
 * raw index into the 4 orientation-preserving elements (see
 * PveFieldScheduler's class javadoc for why) — this harness deliberately
 * still enumerates and asserts all 8 nominal transform slots for sequence 3
 * too, since the fold happens transparently inside activeShapes()/plan() and
 * every one of the 8 slots must still resolve to a CLEARED encounter.
 */
public class PveSolvabilitySteps {

    private static final int MAX_SEED_ATTEMPTS = 60;

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;

    @Given("^第(\\d+)關 Template ([AB])$")
    public void wantedLevelTemplate(int sequence, String templateLetter) {
        ctx.putMemo("pve:solve:sequence", sequence);
        ctx.putMemo("pve:solve:templateA", templateLetter.equals("A"));
        ctx.putMemo("pve:solve:transform", -1); // no transform pinned — any of the 8 is acceptable
    }

    @Given("^第(\\d+)關 Template ([AB]) 變換(\\d+)$")
    public void wantedLevelTemplateAndTransform(int sequence, String templateLetter, int transformIndex) {
        ctx.putMemo("pve:solve:sequence", sequence);
        ctx.putMemo("pve:solve:templateA", templateLetter.equals("A"));
        ctx.putMemo("pve:solve:transform", transformIndex);
    }

    @When("依設計解手順逐一補完雛形（必要時修補震怒清除或狙擊深淵誤放）")
    public void solveWithRetries() {
        int sequence = (int) ctx.getMemo("pve:solve:sequence");
        boolean wantA = (boolean) ctx.getMemo("pve:solve:templateA");
        int wantTransform = (int) ctx.getMemo("pve:solve:transform");

        AssertionError lastFailure = null;
        int tried = 0;
        for (int attempt = 0; tried < MAX_SEED_ATTEMPTS && attempt < MAX_SEED_ATTEMPTS * 20; attempt++) {
            String seed = "solve-" + sequence + "-" + attempt;
            if (PveFieldScheduler.isTemplateA(seed, sequence) != wantA) {
                continue; // wrong template for this seed — doesn't count as a real attempt
            }
            if (wantTransform >= 0 && PveFieldScheduler.transformIndexFor(seed, sequence) != wantTransform) {
                continue; // wrong D4 transform slot for this seed — doesn't count as a real attempt
            }
            tried++;
            try {
                solveOnce(seed, sequence);
                return; // success — encounter is CLEARED, Then step verifies details
            } catch (AssertionError e) {
                lastFailure = e;
            }
        }
        throw new AssertionError("no seed within " + tried + " attempts solved sequence " + sequence
                + " template " + (wantA ? "A" : "B")
                + (wantTransform >= 0 ? " transform " + wantTransform : ""), lastFailure);
    }

    private void solveOnce(String seed, int sequence) {
        String user = "solver-" + seed;
        support.common().playerIsLoggedIn(user);
        ctx.putMemo("pve:user", user);
        support.createRunApi(user, "WARRIOR", seed);
        Assertions.assertThat(ctx.getMemo("pve:runId")).as("run must be created").isNotNull();
        support.jumpToEncounter(sequence);

        support.completeCurrentEncounterShapes(user);

        PveEncounterStatus finalStatus = support.encounter().getStatus();
        if (finalStatus != PveEncounterStatus.CLEARED) {
            throw new AssertionError("encounter ended as " + finalStatus + " instead of CLEARED (seed=" + seed + ")");
        }
    }

    @Then("Boss於手數預算內死亡")
    public void bossDiesWithinBudget() {
        var encounter = support.encounter();
        Assertions.assertThat(encounter.getStatus()).isEqualTo(PveEncounterStatus.CLEARED);
        Assertions.assertThat(encounter.getMovesUsed()).isLessThanOrEqualTo(encounter.getMoveBudget());
        System.out.printf("[pve-solvability] seq=%d movesUsed=%d moveBudget=%d bossHpMax=%d status=%s%n",
                encounter.getSequence(), encounter.getMovesUsed(), encounter.getMoveBudget(),
                encounter.getBossHpMax(), encounter.getStatus());
    }
}
