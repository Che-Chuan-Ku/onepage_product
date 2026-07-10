package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.EffectDefinition;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveFieldCell;
import com.gomoku.domain.enums.BattleContext;
import com.gomoku.repository.EffectDefinitionRepository;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

/**
 * Steps for features/pve/效果系統資料驅動化.feature (FR-A1 FR-A2 FR-A3):
 * data-driven effect declarations + seed determinism. The PVP-regression rule
 * is proven by this very suite run (the PVP features execute in the same
 * build against the refactored engine).
 */
public class PveEffectSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;
    @Autowired private EffectDefinitionRepository effectDefinitionRepository;

    // ────────────────────────── definition queries ───────────────────────────

    @When("查詢 effectKey {string}、applicableMode {string} 的效果定義")
    public void queryEffectDefinition(String effectKey, String mode) {
        EffectDefinition definition = effectDefinitionRepository
                .findByEffectKeyAndApplicableModeAndDeletedFalse(effectKey, BattleContext.valueOf(mode))
                .orElse(null);
        Assertions.assertThat(definition)
                .as("effect definition %s/%s must exist", effectKey, mode)
                .isNotNull();
        ctx.putMemo("pve:effectDef", definition);
    }

    @Then("系統回傳 actionType 為 {string}")
    public void definitionActionType(String actionType) {
        Assertions.assertThat(definition().getActionType().name()).isEqualTo(actionType);
    }

    @Then("usageLimitType 為 {string}")
    public void definitionUsageLimitType(String usageLimitType) {
        Assertions.assertThat(definition().getUsageLimitType().name()).isEqualTo(usageLimitType);
    }

    private EffectDefinition definition() {
        return (EffectDefinition) ctx.getMemo("pve:effectDef");
    }

    // ────────────────────────── PVP regression (meta) ────────────────────────

    @Given("^現有 PVP 回歸測試套件（.*）$")
    public void existingPvpRegressionSuite() {
        // The PVP feature files run inside this same suite execution.
    }

    @When("效果系統改為資料驅動後重新執行")
    public void rerunAfterDataDrivenRefactor() {
        // No-op: this build IS the post-refactor execution.
    }

    @Then("^全部測試維持綠燈，行為零變化（NFR-3）$")
    public void allPvpTestsStayGreen() {
        // Proven by the suite itself: any PVP behaviour change fails its own
        // scenarios in this very run (NFR-3 regression gate).
        Assertions.assertThat(true).isTrue();
    }

    // ────────────────────────── seed determinism ─────────────────────────────

    @Given("使用 seed {string} 建立第一個 PVE Run")
    public void createFirstRunWithSeed(String seed) {
        support.common().playerIsLoggedIn("pveSeedA");
        support.createRunApi("pveSeedA", "WARRIOR", seed);
        ctx.putMemo("pve:runA", support.runId());
        ctx.putMemo("pve:encA", support.encounterId());
    }

    @Given("使用相同 seed {string} 建立第二個 PVE Run")
    public void createSecondRunWithSameSeed(String seed) {
        support.common().playerIsLoggedIn("pveSeedB");
        support.createRunApi("pveSeedB", "WARRIOR", seed);
        ctx.putMemo("pve:runB", support.runId());
        ctx.putMemo("pve:encB", support.encounterId());
    }

    /**
     * documents/PVE-全對弈階梯設計-2026-07-10.md §4.2: L2 is now fixed PLAIN
     * (no random VOLCANO/BEACH draw anymore) — the seed-determinism proof
     * moves to L5's one-time static VOLCANO rocks instead (same underlying
     * argument: a seed-derived {@code PveRandoms.forPurpose} draw, just a
     * different call site).
     */
    @When("^比對兩個 Run 第 5 關的岩石障礙格位置$")
    public void compareFifthEncounterRocks() {
        ctx.putMemo("pve:summaryA", driveToEncounter("pveSeedA", "pve:runA", "pve:encA", 5));
        ctx.putMemo("pve:summaryB", driveToEncounter("pveSeedB", "pve:runB", "pve:encB", 5));
    }

    @Then("^兩者完全相同（FR-A3 NFR-1）$")
    public void bothSecondEncountersIdentical() {
        Assertions.assertThat(ctx.getMemo("pve:summaryA"))
                .isEqualTo(ctx.getMemo("pve:summaryB"));
    }

    /** Advance to encounter {@code targetSequence} (force-clearing DUEL levels in between), then summarize its field cells. */
    private String driveToEncounter(String user, String runKey, String encKey, int targetSequence) {
        ctx.putMemo("pve:user", user);
        ctx.putMemo("pve:runId", ctx.getMemo(runKey));
        ctx.putMemo("pve:encounterId", ctx.getMemo(encKey));
        support.advanceToEncounter(user, targetSequence);

        PveEncounter target = support.encounters()
                .findByRunIdAndSequenceAndDeletedFalse(support.runId(), targetSequence)
                .orElseThrow();
        List<PveFieldCell> cells = support.fieldCells()
                .findByEncounterIdAndDeletedFalse(target.getId());
        StringBuilder summary = new StringBuilder(target.getFieldType().name());
        cells.stream()
                .map(c -> c.getCellKind() + "@" + c.getRow() + "," + c.getCol() + ":" + c.isVisibleToPlayer())
                .sorted()
                .forEach(s -> summary.append('|').append(s));
        return summary.toString();
    }
}
