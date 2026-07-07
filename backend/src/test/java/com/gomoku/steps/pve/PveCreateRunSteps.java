package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.enums.PveRunStatus;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Map;

/** Steps for features/pve/建立挑戰與職業選擇.feature (FR-B1 FR-C8). */
public class PveCreateRunSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;

    @When("玩家 {string} 選擇職業 {string} 建立 PVE Run")
    public void playerCreatesRunWithClass(String user, String classType) {
        support.common().playerIsLoggedIn(user);
        ctx.putMemo("pve:user", user);
        support.createRunApi(user, classType, null);
    }

    @Then("系統建立 Run，classType 為 {string}，gold 為 {int}")
    public void runCreatedWithClassAndGold(String classType, int gold) {
        PveRun run = support.run();
        Assertions.assertThat(run.getClassType().name()).isEqualTo(classType);
        Assertions.assertThat(run.getGold()).isEqualTo(gold);
    }

    @Then("系統建立第1關：棋盤11×11、fieldType {string}、bossHpMax {int}、moveBudget {int}")
    public void firstEncounterCreated(String fieldType, int bossHpMax, int moveBudget) {
        var encounter = support.encounter();
        Assertions.assertThat(encounter.getSequence()).isEqualTo(1);
        Assertions.assertThat(encounter.getBoardRows()).isEqualTo(11);
        Assertions.assertThat(encounter.getBoardCols()).isEqualTo(11);
        Assertions.assertThat(encounter.getFieldType().name()).isEqualTo(fieldType);
        Assertions.assertThat(encounter.getBossHpMax()).isEqualTo(bossHpMax);
        Assertions.assertThat(encounter.getMoveBudget()).isEqualTo(moveBudget);
    }

    @Then("^玩家 \"([^\"]*)\" 持有技能 \"([^\"]*)\" 數量 (\\d+)（.*）$")
    public void playerHoldsSkillWithNote(String user, String skillType, int quantity) {
        Assertions.assertThat(support.skillQuantity(
                        com.gomoku.domain.enums.SkillType.valueOf(skillType)))
                .isEqualTo(quantity);
    }

    @Then("系統發布 PveRunCreated 事件")
    public void pveRunCreatedPublished() {
        Assertions.assertThat(support.run().getStatus()).isEqualTo(PveRunStatus.IN_PROGRESS);
        Assertions.assertThat(support.lastResponse().getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Given("玩家 {string} 已有一個進行中的 PVE Run")
    public void playerHasRunInProgress(String user) {
        support.startRun(user, "WARRIOR");
    }

    @When("玩家 {string} 再次嘗試建立 PVE Run")
    public void playerRetriesCreateRun(String user) {
        support.createRunApi(user, "WARRIOR", null);
    }

    @Given("玩家 {string} 前一個 PVE Run 狀態為 {string}")
    public void playerPreviousRunStatus(String user, String status) {
        support.startRun(user, "WARRIOR");
        PveRun run = support.run();
        run.setStatus(PveRunStatus.valueOf(status));
        run.setEndedAt(Instant.now());
        support.runs().save(run);
    }

    @When("玩家 {string} 選擇職業建立新 PVE Run")
    public void playerCreatesNewRun(String user) {
        support.createRunApi(user, "WARRIOR", null);
    }

    @Given("{string} 為訪客玩家")
    @SuppressWarnings("unchecked")
    public void isGuestPlayer(String nickname) {
        ResponseEntity<Map> resp = support.rest().postForEntity(
                "/api/gmk/v1/auth/guest",
                new HttpEntity<>(String.format("{\"nickname\":\"%s\"}", nickname),
                        support.common().jsonHeaders()),
                Map.class);
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        ctx.putMemo("token:" + nickname, data.get("token"));
    }

    @When("{string} 嘗試建立 PVE Run")
    public void guestAttemptsCreateRun(String nickname) {
        ResponseEntity<Map> resp = support.rest().postForEntity(
                "/api/gmk/v1/pve/runs",
                new HttpEntity<>("{\"classType\":\"WARRIOR\"}", support.common().authHeaders(nickname)),
                Map.class);
        ctx.setLastResponse(resp);
    }
}
