package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveFieldCell;
import com.gomoku.domain.entity.PveFieldState;
import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.PveEncounterStatus;
import com.gomoku.domain.enums.PveFieldType;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.SkillType;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Steps for features/pve/遺物效果.feature (FR-C5). */
public class PveRelicSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;

    @Given("玩家 {string} 持有遺物 {string}")
    public void holdsRelic(String user, String relicType) {
        support.grantRelic(PveRelicType.valueOf(relicType));
    }

    // ────────────────────────── sharp blade ──────────────────────────────────

    @When("玩家形成五連")
    public void playerFormsFive() {
        support.playCleanVerticalLine(support.user());
    }

    // ────────────────────────── diagonal walker ──────────────────────────────

    @Given("^玩家 \"([^\"]*)\" 持有遺物 \"([^\"]*)\"，一般倍率為1\\.0$")
    public void holdsRelicWithBaseMultiplier(String user, String relicType) {
        support.grantRelic(PveRelicType.valueOf(relicType));
    }

    @When("玩家形成斜向五連")
    public void playerFormsDiagonalFive() {
        for (int i = 0; i < 5; i++) {
            ResponseEntity<Map> resp = support.placeMoveApi(support.user(), i, i);
            Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                    .as("diagonal move (%d,%d) must succeed: %s", i, i, resp.getBody())
                    .isTrue();
        }
    }

    @Then("^系統以倍率 ([\\d.]+) 結算該線傷害$")
    public void lineSettledWithMultiplier(String multiplier) {
        List<Map<String, Object>> lines = support.resolvedLines();
        Assertions.assertThat(lines).isNotEmpty();
        Assertions.assertThat(((Number) lines.get(0).get("multiplier")).doubleValue())
                .isEqualTo(Double.parseDouble(multiplier));
    }

    // ────────────────────────── volcano heart ────────────────────────────────

    @When("火山噴發清除{int}顆玩家棋子")
    public void eruptionClearsPlayerStones(int count) {
        Assertions.assertThat(count).as("fixture erupts a 3-stone neighborhood").isEqualTo(3);
        // Plant a hidden eruption cell on the PLAIN first encounter, surround
        // it with 3 stones, then step on it.
        PveFieldCell eruption = new PveFieldCell();
        eruption.setEncounterId(support.encounterId());
        eruption.setCellKind(FieldCellKind.ERUPTION);
        eruption.setRow(8);
        eruption.setCol(8);
        support.fieldCells().save(eruption);

        for (int[] cell : new int[][]{{7, 7}, {7, 8}, {7, 9}}) {
            Assertions.assertThat(support.placeMoveApi(support.user(), cell[0], cell[1])
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
        ctx.putMemo("pve:hpBefore", support.encounter().getBossHpCurrent());
        Assertions.assertThat(support.placeMoveApi(support.user(), 8, 8)
                .getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Then("^系統對Boss額外造成傷害 (\\d+)（每顆10）$")
    public void bossExtraDamage(int damage) {
        int before = (int) ctx.getMemo("pve:hpBefore");
        Assertions.assertThat(before - support.encounter().getBossHpCurrent()).isEqualTo(damage);
    }

    // ────────────────────────── tide breakwater ──────────────────────────────

    @Given("玩家 {string} 持有遺物 {string}，BEACH場地海浪即將觸發")
    public void holdsRelicWithWaveImminent(String user, String relicType) {
        support.grantRelic(PveRelicType.valueOf(relicType));
        // Seam: turn the first encounter into a BEACH field about to wave.
        PveEncounter encounter = support.encounter();
        encounter.setFieldType(PveFieldType.BEACH);
        support.encounters().save(encounter);
        PveFieldState state = support.fieldStates()
                .findByEncounterIdAndDeletedFalse(support.encounterId()).orElseThrow();
        state.setSeaSide(BoardSide.NORTH);
        support.fieldStates().save(state);

        // Player stones inside the ocean rows (0..4).
        for (int[] cell : new int[][]{{0, 0}, {1, 2}, {2, 4}}) {
            Assertions.assertThat(support.placeMoveApi(user, cell[0], cell[1])
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
        ctx.putMemo("pve:oceanStones", support.stoneKeys(support.lastState()));

        state = support.fieldStates()
                .findByEncounterIdAndDeletedFalse(support.encounterId()).orElseThrow();
        state.setWaveMoveCounter(9);
        support.fieldStates().save(state);
    }

    // NOTE: the "海浪觸發" When step is shared with the PVP feature and lives in
    // SeriousFieldSteps, which branches to triggerPveWave() when a PVE
    // encounter is in scope.

    /** The 10th placement (counter 9 -> 10) settles the PVE wave. */
    public void triggerPveWave() {
        Assertions.assertThat(support.placeMoveApi(support.user(), 9, 9)
                .getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Then("玩家棋子維持原位，不被推移或移除")
    @SuppressWarnings("unchecked")
    public void playerStonesStayPut() {
        Set<Long> before = (Set<Long>) ctx.getMemo("pve:oceanStones");
        Set<Long> after = support.stoneKeys(support.lastState());
        Assertions.assertThat(after).containsAll(before);
    }

    // ────────────────────────── metronome ────────────────────────────────────

    @Given("玩家 {string} 持有遺物 {string}，第1關已落滿30手")
    public void holdsRelicWithFirstEncounterFull(String user, String relicType) {
        support.grantRelic(PveRelicType.valueOf(relicType));
        // Seam: encounter 1 cleared with all 30 moves used; run sits at encounter 2.
        PveEncounter first = support.encounter();
        first.setMovesUsed(30);
        first.setStatus(PveEncounterStatus.CLEARED);
        first.setClearedAt(Instant.now());
        support.encounters().save(first);
        support.jumpToEncounter(2);
    }

    @When("^玩家於第2關第5手落子（Run累計第35手）$")
    public void fifthMoveOfSecondEncounter() {
        support.placeFillers(support.user(), 5);
    }

    @Then("^系統倍率永久提升 0\\.1（.*）$")
    public void multiplierPermanentlyRaised() {
        Assertions.assertThat(support.run().getMetronomeMultiplierBonus())
                .isEqualByComparingTo(new BigDecimal("0.10"));
    }

    @Then("該加成於本Run剩餘關卡持續生效")
    public void bonusPersistsForRun() {
        // Persisted on the run row — later encounters read the same value.
        Assertions.assertThat(support.run().getMetronomeMultiplierBonus())
                .isEqualByComparingTo(new BigDecimal("0.10"));
    }

    // ────────────────────────── recycler ─────────────────────────────────────

    @When("本關因連線移除的棋子累計達{int}顆")
    public void lineRemovalsReach(int count) {
        Assertions.assertThat(count % 5).as("fixture plays 5-lines").isZero();
        support.setBossHp(100000);
        PveEncounter encounter = support.encounter();
        encounter.setBossHpMax(100000);
        support.encounters().save(encounter);
        for (int i = 0; i < count / 5; i++) {
            support.playCleanVerticalLine(support.user());
        }
    }

    @Then("^本關手數預算增加 (\\d+)（每10顆\\+1）$")
    public void moveBudgetIncreased(int extra) {
        Assertions.assertThat(support.encounter().getMoveBudget()).isEqualTo(30 + extra);
    }

    // ────────────────────────── gemini star ──────────────────────────────────

    @When("^玩家一手同時完成橫向與縱向兩條五連（各50，合計100）$")
    public void oneHandCompletesTwoLines() {
        String user = support.user();
        for (int c = 3; c < 7; c++) {
            Assertions.assertThat(support.placeMoveApi(user, 7, c)
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
        for (int r = 3; r < 7; r++) {
            Assertions.assertThat(support.placeMoveApi(user, r, 7)
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
        Assertions.assertThat(support.placeMoveApi(user, 7, 7)
                .getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Then("^系統該手總傷害結算為 (\\d+)（.*）$")
    public void handTotalDamageIs(int damage) {
        Map<String, Object> resolution = support.lastResolution();
        Assertions.assertThat(resolution).isNotNull();
        Assertions.assertThat(((Number) resolution.get("damageDealt")).intValue()).isEqualTo(damage);
    }

    // ────────────────────────── chain core ───────────────────────────────────

    @When("玩家使用橫劈技能推擠")
    public void useHorizontalSlashPush() {
        String user = support.user();
        Assertions.assertThat(support.placeMoveApi(user, 4, 5)
                .getStatusCode().is2xxSuccessful()).isTrue();
        support.grantSkill(SkillType.HORIZONTAL_SLASH, 1);
        ResponseEntity<Map> resp = support.useSkillApi(user,
                "{\"skillType\":\"HORIZONTAL_SLASH\",\"direction\":\"UP\",\"anchor\":{\"row\":5,\"col\":5}}");
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("slash cast must succeed: %s", resp.getBody())
                .isTrue();
    }

    @Then("^推擠距離為原距離\\+1格（依推擠解算器規則連鎖）$")
    public void pushDistancePlusOne() {
        Set<Long> stones = support.stoneKeys(support.lastState());
        Assertions.assertThat(stones)
                .as("stone pushed 2 cells (1 base + 1 chain core)")
                .contains(PveCommonSteps.key(2, 5))
                .doesNotContain(PveCommonSteps.key(3, 5), PveCommonSteps.key(4, 5));
    }
}
