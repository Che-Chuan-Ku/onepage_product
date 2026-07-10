package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.PveFieldType;
import com.gomoku.game.PveFieldGeometry;
import com.gomoku.game.PveFieldScheduler;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Steps for features/pve/Run循環與場地排程.feature (FR-C1 FR-C2). Plan-level
 * scenarios assert the pure seed-deterministic scheduler; the progression
 * scenario drives the real API (clear -> shop skip -> next encounter).
 */
public class PveScheduleSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;

    private List<PveFieldScheduler.EncounterPlan> plans() {
        @SuppressWarnings("unchecked")
        List<PveFieldScheduler.EncounterPlan> plans =
                (List<PveFieldScheduler.EncounterPlan>) ctx.getMemo("pve:plans");
        return plans;
    }

    @When("Run依序建立第1至8關")
    public void planAllEightEncounters() {
        List<PveFieldScheduler.EncounterPlan> plans = new ArrayList<>();
        for (int seq = 1; seq <= 8; seq++) {
            plans.add(PveFieldScheduler.plan(support.run().getSeed(), seq));
        }
        ctx.putMemo("pve:plans", plans);
    }

    @Then("^各關bossHpMax依序為 ([\\d,]+)$")
    public void bossHpCurveMatches(String expectedCsv) {
        int[] expected = Arrays.stream(expectedCsv.split(",")).mapToInt(Integer::parseInt).toArray();
        List<PveFieldScheduler.EncounterPlan> plans = plans();
        Assertions.assertThat(plans).hasSize(expected.length);
        for (int i = 0; i < expected.length; i++) {
            Assertions.assertThat(plans.get(i).bossHpMax()).isEqualTo(expected[i]);
        }
    }

    @Then("^各關moveBudget依序為 ([\\d,]+)$")
    public void moveBudgetCurveMatches(String expectedCsv) {
        int[] expected = Arrays.stream(expectedCsv.split(",")).mapToInt(Integer::parseInt).toArray();
        List<PveFieldScheduler.EncounterPlan> plans = plans();
        Assertions.assertThat(plans).hasSize(expected.length);
        for (int i = 0; i < expected.length; i++) {
            Assertions.assertThat(plans.get(i).moveBudget()).isEqualTo(expected[i]);
        }
    }

    // ────────────────────────── §0/§2 pre-placed shapes (documents/PVE-關卡重設計-2026-07-08.md) ──

    @When("Run建立第{int}關")
    public void nthEncounterExists(int sequence) {
        support.jumpToEncounter(sequence);
    }

    private List<PveFieldScheduler.ShapeSpec> currentShapes() {
        return PveFieldScheduler.activeShapes(support.run().getSeed(), support.encounter().getSequence());
    }

    @Then("該關預放黑棋雛形數為 {int} 條TYPE_A、{int} 條TYPE_B")
    public void shapeCountsMatch(int typeACount, int typeBCount) {
        assertShapeCounts(typeACount, typeBCount, false);
    }

    @Then("該關預放黑棋雛形數為 {int} 條TYPE_A、{int} 條TYPE_B（不含備援）")
    public void shapeCountsMatchExcludingBackup(int typeACount, int typeBCount) {
        assertShapeCounts(typeACount, typeBCount, false);
    }

    private void assertShapeCounts(int typeACount, int typeBCount, boolean includeBackup) {
        List<PveFieldScheduler.ShapeSpec> shapes = currentShapes().stream()
                .filter(s -> includeBackup || !s.backup())
                .toList();
        long a = shapes.stream().filter(s -> s.type() == PveFieldScheduler.ShapeType.TYPE_A).count();
        long b = shapes.stream().filter(s -> s.type() == PveFieldScheduler.ShapeType.TYPE_B).count();
        Assertions.assertThat(a).isEqualTo(typeACount);
        Assertions.assertThat(b).isEqualTo(typeBCount);
    }

    @Then("該關另有 {int} 條TYPE_B備援雛形，供深淵突變誤放時的替代解法")
    public void backupShapeCountMatches(int backupCount) {
        long backups = currentShapes().stream()
                .filter(PveFieldScheduler.ShapeSpec::backup)
                .filter(s -> s.type() == PveFieldScheduler.ShapeType.TYPE_B)
                .count();
        Assertions.assertThat(backups).isEqualTo(backupCount);
    }

    @Then("^該關解謎所需手數為 (\\d+)，與moveBudget相差在(\\d+)–(\\d+)%餘裕內$")
    public void solutionMoveCountWithinMargin(int expectedT, int minMarginPercent, int maxMarginPercent) {
        int t = currentShapes().stream()
                .filter(s -> !s.backup())
                .mapToInt(s -> s.completionCells().size())
                .sum();
        Assertions.assertThat(t).isEqualTo(expectedT);
        int budget = support.encounter().getMoveBudget();
        double marginPercent = 100.0 * (budget - t) / t;
        Assertions.assertThat(marginPercent).isBetween((double) minMarginPercent, (double) maxMarginPercent);
    }

    @When("^Run依序建立第3、6、8關$")
    public void planMutationSequences() {
        List<PveFieldScheduler.EncounterPlan> plans = new ArrayList<>();
        for (int seq : new int[]{3, 6, 8}) {
            plans.add(PveFieldScheduler.plan(support.run().getSeed(), seq));
        }
        ctx.putMemo("pve:plans", plans);
    }

    @Then("各關minorDisruptionType皆為 {string}")
    public void allPlansHaveMinorDisruption(String expected) {
        for (PveFieldScheduler.EncounterPlan plan : plans()) {
            Assertions.assertThat(plan.minorDisruptionType().name()).isEqualTo(expected);
        }
    }

    @Then("該關minorDisruptionType為 {string}、{string} 或 {string} 其中之一")
    public void minorDisruptionIsOneOf(String a, String b, String c) {
        Assertions.assertThat(support.encounter().getMinorDisruptionType().name()).isIn(a, b, c);
    }

    @Then("fieldType為 {string}，該關無任何場地效果")
    public void fieldTypeWithNoEffects(String fieldType) {
        Assertions.assertThat(support.encounter().getFieldType().name()).isEqualTo(fieldType);
        // "無任何場地效果" = no VOLCANO/BEACH terrain cells (OBSTACLE/ERUPTION/
        // TIDE) — every level now legitimately pre-places INITIAL_BLACK shape
        // cells regardless of fieldType (documents/PVE-關卡重設計-2026-07-08.md
        // §0/§6), so only the terrain kinds are asserted empty here.
        Assertions.assertThat(support.fieldCells()
                        .findByEncounterIdAndDeletedFalse(support.encounterId()))
                .noneMatch(cell -> cell.getCellKind() != FieldCellKind.INITIAL_BLACK);
    }

    @When("Run依序建立第3、4、6、8關")
    public void planPlainSequences() {
        List<PveFieldScheduler.EncounterPlan> plans = new ArrayList<>();
        for (int seq : new int[]{3, 4, 6, 8}) {
            plans.add(PveFieldScheduler.plan(support.run().getSeed(), seq));
        }
        ctx.putMemo("pve:plans", plans);
    }

    @Then("各關fieldType皆為 {string}")
    public void allPlansHaveFieldType(String fieldType) {
        for (PveFieldScheduler.EncounterPlan plan : plans()) {
            Assertions.assertThat(plan.fieldType().name()).isEqualTo(fieldType);
        }
    }

    @Given("使用相同seed的兩個Run")
    public void twoRunsWithSameSeed() {
        String seed = "same-seed-fixture";
        support.common().playerIsLoggedIn("pveA");
        support.common().playerIsLoggedIn("pveB");
        support.createRunApi("pveA", "WARRIOR", seed);
        ctx.putMemo("pve:seedA", seed);
        support.createRunApi("pveB", "WARRIOR", seed);
        ctx.putMemo("pve:seedB", seed);
    }

    @When("兩個Run分別建立第2關")
    public void bothRunsPlanSecondEncounter() {
        ctx.putMemo("pve:planA", PveFieldScheduler.plan((String) ctx.getMemo("pve:seedA"), 2));
        ctx.putMemo("pve:planB", PveFieldScheduler.plan((String) ctx.getMemo("pve:seedB"), 2));
    }

    @Then("兩者fieldType判定結果相同（FR-A3決定性）")
    public void bothFieldTypesMatch() {
        PveFieldScheduler.EncounterPlan a = (PveFieldScheduler.EncounterPlan) ctx.getMemo("pve:planA");
        PveFieldScheduler.EncounterPlan b = (PveFieldScheduler.EncounterPlan) ctx.getMemo("pve:planB");
        Assertions.assertThat(a.fieldType()).isEqualTo(b.fieldType());
    }

    @Given("第{int}關由seed判定為 {string}")
    public void sequenceJudgedAsFieldType(int sequence, String fieldType) {
        String seed = probeSeed(sequence, PveFieldType.valueOf(fieldType));
        ctx.putMemo("pve:probeSeed", seed);
        ctx.putMemo("pve:probeSeq", sequence);
    }

    private String probeSeed(int sequence, PveFieldType wanted) {
        for (int i = 0; i < 200; i++) {
            String candidate = "probe-" + i;
            if (PveFieldScheduler.fieldTypeFor(candidate, sequence) == wanted) {
                return candidate;
            }
        }
        throw new AssertionError("no seed found producing " + wanted + " at sequence " + sequence);
    }

    @When("系統生成該關場地")
    public void generateProbedField() {
        String seed = (String) ctx.getMemo("pve:probeSeed");
        int seq = (int) ctx.getMemo("pve:probeSeq");
        ctx.putMemo("pve:probePlan", PveFieldScheduler.plan(seed, seq));
    }

    private PveFieldScheduler.EncounterPlan probePlan() {
        return (PveFieldScheduler.EncounterPlan) ctx.getMemo("pve:probePlan");
    }

    @Then("系統生成 {int} 至 {int} 個可見障礙格")
    public void visibleObstaclesInRange(int min, int max) {
        long obstacles = probePlan().cells().stream()
                .filter(c -> c.kind() == FieldCellKind.OBSTACLE && c.visible())
                .count();
        Assertions.assertThat(obstacles).isBetween((long) min, (long) max);
    }

    @Then("系統生成至多 {int} 個隱藏噴發格（server-only）")
    public void hiddenEruptionsAtMost(int max) {
        long eruptions = probePlan().cells().stream()
                .filter(c -> c.kind() == FieldCellKind.ERUPTION)
                .count();
        Assertions.assertThat(eruptions).isBetween(1L, (long) max);
        probePlan().cells().stream()
                .filter(c -> c.kind() == FieldCellKind.ERUPTION)
                .forEach(c -> Assertions.assertThat(c.visible()).isFalse());
    }

    @Then("海側起始為5行，沙側為6行（⌊11\\/2⌋=5）")
    public void seaSandSplit() {
        Assertions.assertThat(probePlan().seaSide()).isNotNull();
        Assertions.assertThat(PveFieldGeometry.INITIAL_SEA_ROWS).isEqualTo(5);
        Assertions.assertThat(PveFieldGeometry.BOARD_SIZE - PveFieldGeometry.INITIAL_SEA_ROWS)
                .isEqualTo(6);
    }

    @Then("海浪每10手落子結算一次（沿用推擠解算器規則）")
    public void waveEveryTenMoves() {
        Assertions.assertThat(PveFieldGeometry.WAVE_HANDS).isEqualTo(10);
    }

    @Given("玩家已通過第1關")
    public void playerClearedFirstEncounter() {
        support.clearCurrentEncounterCheaply(support.user());
    }

    @When("系統推進至下一關（商店結束後）")
    public void advanceAfterShop() {
        Assertions.assertThat(support.skipShopApi(support.user()).getStatusCode().is2xxSuccessful())
                .isTrue();
    }

    @Then("系統建立第2關，currentEncounterSequence為2")
    @SuppressWarnings("unchecked")
    public void secondEncounterCreated() {
        Map<String, Object> run = support.getCurrentRunApi(support.user());
        Assertions.assertThat(((Number) run.get("currentEncounterSequence")).intValue()).isEqualTo(2);
        Map<String, Object> encounter = (Map<String, Object>) run.get("currentEncounter");
        Assertions.assertThat(((Number) encounter.get("sequence")).intValue()).isEqualTo(2);
    }

    @Then("系統發布 PveEncounterCreated 事件")
    public void encounterCreatedPublished() {
        Assertions.assertThat(support.encounters()
                        .findByRunIdAndSequenceAndDeletedFalse(support.runId(), 2))
                .isPresent();
    }

    // ────────────────────────── §5 D4 board transform ──

    @Then("該關套用的D4盤面變換編號為0至7之一")
    public void transformIndexInRange() {
        int idx = PveFieldScheduler.transformIndexFor(support.run().getSeed(), support.encounter().getSequence());
        Assertions.assertThat(idx).isBetween(0, 7);
    }

    @Then("兩者預放黑棋雛形座標相同（FR-A3決定性）")
    public void bothInitialShapeCellsMatch() {
        PveFieldScheduler.EncounterPlan a = (PveFieldScheduler.EncounterPlan) ctx.getMemo("pve:planA");
        PveFieldScheduler.EncounterPlan b = (PveFieldScheduler.EncounterPlan) ctx.getMemo("pve:planB");
        List<List<Integer>> cellsA = initialBlackCells(a);
        List<List<Integer>> cellsB = initialBlackCells(b);
        Assertions.assertThat(cellsA).isEqualTo(cellsB);
    }

    private List<List<Integer>> initialBlackCells(PveFieldScheduler.EncounterPlan plan) {
        return plan.cells().stream()
                .filter(c -> c.kind() == FieldCellKind.INITIAL_BLACK)
                .map(c -> List.of(c.row(), c.col()))
                .sorted(java.util.Comparator.<List<Integer>>comparingInt(rc -> rc.get(0))
                        .thenComparingInt(rc -> rc.get(1)))
                .toList();
    }

    @When("系統對第3關掃描100個seed的D4變換結果")
    public void scanSequenceThreeTransforms() {
        List<PveFieldScheduler.ShapeSpec> allShapes = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            allShapes.addAll(PveFieldScheduler.activeShapes("d4-scan-seed-" + i, 3));
        }
        ctx.putMemo("pve:scannedShapes", allShapes);
    }

    @Then("每個非誘餌雛形結果皆為VERTICAL（避免ONE_EYE使該線傷害歸零）")
    @SuppressWarnings("unchecked")
    public void allScannedShapesRemainVertical() {
        List<PveFieldScheduler.ShapeSpec> allShapes =
                (List<PveFieldScheduler.ShapeSpec>) ctx.getMemo("pve:scannedShapes");
        Assertions.assertThat(allShapes).isNotEmpty();
        // B5(a) 調校（2026-07-08）：第3關新增一個HORIZONTAL誘餌窗（backup:true，
        // ONE_EYE使其傷害歸零，補了浪費一手）。它是"backup"，本就不計入該關目標
        // 手數T、也不影響「突變對本關傷害輸出零影響」的結論（因為它本身就是特意
        // 設計成傷害歸零的誘餌）——真正需要維持VERTICAL的只有非backup的計傷雛形。
        Assertions.assertThat(allShapes)
                .filteredOn(s -> !s.backup())
                .allMatch(s -> s.orientation() == PveFieldScheduler.ShapeOrientation.VERTICAL);
        Assertions.assertThat(allShapes)
                .filteredOn(PveFieldScheduler.ShapeSpec::backup)
                .allMatch(s -> s.orientation() == PveFieldScheduler.ShapeOrientation.HORIZONTAL);
    }
}
