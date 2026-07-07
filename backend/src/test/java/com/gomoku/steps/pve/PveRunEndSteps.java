package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.PveRunStatus;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.dto.response.PveRunResultResponse;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Map;

/** Steps for features/pve/Run終止與結算.feature (FR-C7). */
public class PveRunEndSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關手數用盡且BossHP>0$")
    public void atEncounterWithMovesExhausted(String user, int sequence) {
        support.jumpToEncounter(sequence);
        PveEncounter encounter = support.encounter();
        encounter.setMovesUsed(encounter.getMoveBudget() - 1);
        support.encounters().save(encounter);
    }

    @When("系統判定該關失敗")
    public void systemJudgesEncounterFailed() {
        support.placeFillers(support.user(), 1);
        Assertions.assertThat(support.encounter().getStatus().name()).isEqualTo("FAILED");
    }

    @Then("^系統發布 PveRunEnded 事件，reachedEncounterSequence為(\\d+)$")
    public void runEndedWithReached(int reached) {
        PveRun run = support.run();
        Assertions.assertThat(run.getEndedAt()).isNotNull();
        Assertions.assertThat(run.getReachedEncounterSequence()).isEqualTo(reached);
    }

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關進行中$")
    public void atEncounterInProgress(String user, int sequence) {
        support.jumpToEncounter(sequence);
    }

    @When("玩家 {string} 主動放棄Run")
    @SuppressWarnings("unchecked")
    public void playerAbandonsRun(String user) {
        ResponseEntity<Map> resp = support.rest().postForEntity(
                "/api/gmk/v1/pve/runs/" + support.runId() + "/actions/abandon",
                new HttpEntity<>("{}", support.common().authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
    }

    @Then("系統發布 PveRunEnded 事件")
    public void runEndedPublished() {
        Assertions.assertThat(support.run().getEndedAt()).isNotNull();
    }

    @When("系統結算Run")
    public void systemSettlesRun() {
        ctx.putMemo("pve:runResult", support.challenge().buildRunResult(support.run()));
    }

    @Then("^reachedEncounterSequence為(\\d+)$")
    public void reachedSequenceIs(int reached) {
        Assertions.assertThat(support.run().getReachedEncounterSequence()).isEqualTo(reached);
    }

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關失敗，全Run總傷害累計(\\d+)，共獲得(\\d+)金幣、花費(\\d+)金幣$")
    public void failedRunArrangement(String user, int sequence, int totalDamage,
                                     int goldEarned, int goldSpent) {
        PveRun run = support.run();
        run.setStatus(PveRunStatus.LOST);
        run.setCurrentEncounterSequence(sequence);
        run.setReachedEncounterSequence(sequence - 1);
        run.setTotalDamageDealt(totalDamage);
        run.setGoldEarned(goldEarned);
        run.setGoldSpent(goldSpent);
        run.setEndedAt(Instant.now());
        support.runs().save(run);
    }

    @Given("玩家 {string} 最終持有遺物 {string}、技能 {string} 數量{int}")
    public void finalHoldings(String user, String relicType, String skillType, int quantity) {
        support.grantRelic(PveRelicType.valueOf(relicType));
        support.grantSkill(SkillType.valueOf(skillType), quantity);
    }

    @When("玩家 {string} 查看Run結算")
    public void playerViewsRunResult(String user) {
        ctx.putMemo("pve:runResult", support.challenge().buildRunResult(support.run()));
    }

    @Then("^系統顯示 reachedEncounterSequence為(\\d+)、totalDamageDealt為(\\d+)$")
    public void resultShowsReachedAndDamage(int reached, int totalDamage) {
        PveRunResultResponse result = result();
        Assertions.assertThat(result.reachedEncounterSequence()).isEqualTo(reached);
        Assertions.assertThat(result.totalDamageDealt()).isEqualTo(totalDamage);
    }

    @Then("^系統顯示 goldEarned為(\\d+)、goldSpent為(\\d+)$")
    public void resultShowsGold(int earned, int spent) {
        PveRunResultResponse result = result();
        Assertions.assertThat(result.goldEarned()).isEqualTo(earned);
        Assertions.assertThat(result.goldSpent()).isEqualTo(spent);
    }

    @Then("系統顯示最終持有遺物與技能清單")
    public void resultShowsHoldings() {
        PveRunResultResponse result = result();
        Assertions.assertThat(result.finalHeldRelics()).isNotEmpty();
        Assertions.assertThat(result.finalHeldSkills()).isNotEmpty();
    }

    private PveRunResultResponse result() {
        return (PveRunResultResponse) ctx.getMemo("pve:runResult");
    }

    // ────────────────────────── authoritative result query (FR-C7) ───────────
    // GET /pve/runs/{runId}/result: dedicated read for run settlement when the
    // ending action (natural WON/LOST) didn't itself return the settlement —
    // unlike abandon/shop-skip which do.

    @Given("^玩家 \"([^\"]*)\" 已通過第8關，Run狀態為 \"WON\"$")
    public void runWonAfterEncounter8(String user) {
        PveRun run = support.run();
        run.setStatus(PveRunStatus.WON);
        run.setCurrentEncounterSequence(8);
        run.setReachedEncounterSequence(8);
        run.setGoldEarned(150);
        run.setGoldSpent(50);
        run.setTotalDamageDealt(1200);
        run.setEndedAt(Instant.now());
        support.runs().save(run);
    }

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關手數用盡失敗，Run狀態為 \"LOST\"$")
    public void runLostAtEncounter(String user, int sequence) {
        PveRun run = support.run();
        run.setStatus(PveRunStatus.LOST);
        run.setCurrentEncounterSequence(sequence);
        run.setReachedEncounterSequence(sequence - 1);
        run.setGoldEarned(70);
        run.setGoldSpent(30);
        run.setEndedAt(Instant.now());
        support.runs().save(run);
    }

    @When("^玩家 \"([^\"]*)\" 查詢該Run的結算$")
    public void queryRunResultViaApi(String user) {
        ctx.putMemo("pve:runResultQuery", support.getRunResultApi(user));
    }

    @Then("^系統回傳 status為 \"([A-Z]+)\"、reachedEncounterSequence為(\\d+)$")
    public void queriedResultStatusAndReached(String status, int reached) {
        Map<String, Object> data = queriedRunResult();
        Assertions.assertThat(data.get("status")).isEqualTo(status);
        Assertions.assertThat(((Number) data.get("reachedEncounterSequence")).intValue()).isEqualTo(reached);
    }

    @Then("系統回傳權威的 goldEarned 與 goldSpent，不需前端自行推算")
    public void queriedResultAuthoritativeGoldNoted() {
        queriedResultAuthoritativeGold();
    }

    @Then("系統回傳權威的 goldEarned 與 goldSpent")
    public void queriedResultAuthoritativeGold() {
        Map<String, Object> data = queriedRunResult();
        Assertions.assertThat(data.get("goldEarned")).isNotNull();
        Assertions.assertThat(data.get("goldSpent")).isNotNull();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> queriedRunResult() {
        return (Map<String, Object>) ctx.getMemo("pve:runResultQuery");
    }
}
