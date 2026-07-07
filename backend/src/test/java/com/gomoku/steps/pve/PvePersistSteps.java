package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;

/** Steps for features/pve/關卡持久化與續玩.feature (FR-B6). */
public class PvePersistSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;

    @Given("玩家 {string} 有一個進行中的PVE Run，第2關進行中，已落子12手")
    public void runAtSecondEncounterWithMoves(String user) {
        support.startRun(user, "WARRIOR");
        support.clearCurrentEncounterCheaply(user);
        Assertions.assertThat(support.skipShopApi(user).getStatusCode().is2xxSuccessful()).isTrue();
        Assertions.assertThat(support.encounter().getSequence()).isEqualTo(2);
        support.placeFillers(user, 12);
        // Snapshot as of the last settle — the "state before disconnect".
        ctx.putMemo("pve:snapshotStones", support.stoneKeys(support.lastState()));
    }

    @When("玩家 {string} 查詢目前進行中的Run")
    public void queryCurrentRun(String user) {
        ctx.putMemo("pve:queriedRun", support.getCurrentRunApi(user));
    }

    @Then("^系統回傳第2關狀態，movesUsed為(\\d+)$")
    @SuppressWarnings("unchecked")
    public void returnsSecondEncounterState(int movesUsed) {
        Map<String, Object> run = (Map<String, Object>) ctx.getMemo("pve:queriedRun");
        Assertions.assertThat(run).isNotNull();
        Map<String, Object> encounter = (Map<String, Object>) run.get("currentEncounter");
        Assertions.assertThat(encounter).isNotNull();
        Assertions.assertThat(((Number) encounter.get("sequence")).intValue()).isEqualTo(2);
        Assertions.assertThat(((Number) encounter.get("movesUsed")).intValue()).isEqualTo(movesUsed);
    }

    @Then("棋盤快照與已使用技能清單皆為斷線前最後狀態")
    @SuppressWarnings("unchecked")
    public void snapshotMatchesLastState() {
        Map<String, Object> run = (Map<String, Object>) ctx.getMemo("pve:queriedRun");
        Map<String, Object> encounter = (Map<String, Object>) run.get("currentEncounter");
        Assertions.assertThat(support.stoneKeys(encounter))
                .isEqualTo(ctx.getMemo("pve:snapshotStones"));
        Assertions.assertThat(encounter.get("usedSkills")).isNotNull();
    }

    @When("玩家 {string} 查詢該進行中關卡的狀態")
    public void queryEncounterState(String user) {
        ctx.putMemo("pve:queriedEncounter", support.getEncounterApi(user));
    }

    @Then("系統回傳Boss HP、剩餘手數、場地狀態（含已觸發的隱藏格）、已使用技能清單")
    @SuppressWarnings("unchecked")
    public void encounterStateContainsResumeData() {
        Map<String, Object> encounter = (Map<String, Object>) ctx.getMemo("pve:queriedEncounter");
        Assertions.assertThat(encounter).isNotNull();
        Assertions.assertThat(encounter.get("bossHpCurrent")).isNotNull();
        Assertions.assertThat(encounter.get("moveBudget")).isNotNull();
        Assertions.assertThat(encounter.get("movesUsed")).isNotNull();
        Assertions.assertThat(encounter.get("fieldType")).isNotNull();
        Assertions.assertThat(encounter.get("obstacles")).isNotNull();
        Assertions.assertThat(encounter.get("usedSkills")).isNotNull();
    }
}
