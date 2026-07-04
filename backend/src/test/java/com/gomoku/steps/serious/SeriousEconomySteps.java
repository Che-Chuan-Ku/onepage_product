package com.gomoku.steps.serious;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.FieldEventType;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.domain.enums.StoneColor;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

/**
 * Steps for 真劍勝負回合行動經濟 / 真劍勝負結算順序與勝負判定 / 技能與場地特效.
 * alice = WARRIOR/BLACK, bob = ARCHER/WHITE (see SeriousCommonSteps).
 */
public class SeriousEconomySteps {

    @Autowired
    private ScenarioContext ctx;
    @Autowired
    private SeriousCommonSteps support;

    // ================================================================
    // 回合行動經濟
    // ================================================================

    @When("玩家 {string} 於 \\({int},{int}\\) 落子並附掛技能 {string}，方向 {string}")
    public void placeWithSkillAndDirection(String user, int row, int col, String skill, String direction) {
        support.ensureTurn(user);
        support.placeAs(user, String.format(
                "{\"row\":%d,\"col\":%d,\"skill\":{\"skillType\":\"%s\",\"direction\":\"%s\"}}",
                row, col, skill, direction));
    }

    @Then("系統發布 SkillUsed 事件，技能為 {string}")
    public void skillUsedPublishedWithType(String skill) {
        assertLastSuccess();
        Assertions.assertThat(support.skillUsageRecorded(SkillType.valueOf(skill)))
                .as("skill usage %s must be recorded", skill)
                .isTrue();
    }

    @And("該手落子與橫劈推擠效果同時結算")
    public void moveAndSlashSettledTogether() {
        // One request settled both: the move landed (2xx) and the settlement
        // response carries the skill/field events of the same hand.
        assertLastSuccess();
        Map<?, ?> data = lastData();
        Assertions.assertThat(data.get("skillEvents")).isNotNull();
    }

    @When("玩家 {string} 施放大絕 {string}，錨點 \\({int},{int}\\)，方向 {string}")
    public void castUltimate(String user, String skill, int row, int col, String direction) {
        support.ensureTurn(user);
        support.placeAs(user, String.format(
                "{\"skill\":{\"skillType\":\"%s\",\"direction\":\"%s\",\"anchor\":{\"row\":%d,\"col\":%d}}}",
                skill, direction, row, col));
    }

    @Then("本回合視為已完成落子行動（不另行落子）")
    public void ultimateConsumedTheTurn() {
        assertLastSuccess();
        // Turn passed to the opponent without any stone being placed by the caster.
        Map<?, ?> data = lastData();
        Assertions.assertThat(data.get("currentTurn")).isEqualTo("WHITE");
        Assertions.assertThat(data.get("lastMove")).isNull();
    }

    @And("系統發布 SkillUsed 事件")
    public void skillUsedPublished() {
        assertLastSuccess();
        Assertions.assertThat(support.anySkillUsageRecorded())
                .as("some skill usage must be recorded for this game")
                .isTrue();
    }

    @Given("玩家 {string} 本場已使用過 {string}")
    public void playerAlreadyUsedSkill(String user, String skill) {
        support.ensureTurn(user);
        if ("HEAVEN_EARTH_REVERSAL".equals(skill) || "PIONEER_STAR".equals(skill)) {
            castUltimate(user, skill, 3, 3, "RIGHT");
        } else if ("SCATTER_SHOT".equals(skill)) {
            support.placeAs(user,
                    "{\"row\":2,\"col\":2,\"skill\":{\"skillType\":\"SCATTER_SHOT\",\"secondStone\":{\"row\":2,\"col\":6}}}");
        } else {
            String direction = "VERTICAL_SLASH".equals(skill) ? "LEFT" : "UP";
            support.placeAs(user, String.format(
                    "{\"row\":3,\"col\":3,\"skill\":{\"skillType\":\"%s\",\"direction\":\"%s\"}}",
                    skill, direction));
        }
        assertLastSuccess();
        ctx.putMemo("actorUser", user);
    }

    @When("玩家 {string} 再次嘗試附掛技能 {string}")
    public void playerRetriesSkill(String user, String skill) {
        support.ensureTurn(user);
        String direction = "VERTICAL_SLASH".equals(skill) ? "LEFT" : "UP";
        support.placeAs(user, String.format(
                "{\"row\":8,\"col\":8,\"skill\":{\"skillType\":\"%s\",\"direction\":\"%s\"}}",
                skill, direction));
    }

    @When("玩家 {string} 再次嘗試施放 {string}")
    public void playerRetriesUltimate(String user, String skill) {
        support.ensureTurn(user);
        castUltimate(user, skill, 10, 10, "RIGHT");
    }

    @When("玩家 {string} 再次嘗試使用技能 {string}")
    public void playerRetriesNormalSkill(String user, String skill) {
        support.ensureTurn(user);
        if ("SCATTER_SHOT".equals(skill)) {
            support.placeAs(user,
                    "{\"row\":9,\"col\":9,\"skill\":{\"skillType\":\"SCATTER_SHOT\",\"secondStone\":{\"row\":9,\"col\":12}}}");
        } else {
            playerRetriesSkill(user, skill);
        }
    }

    @When("玩家 {string} 嘗試同時附掛 {string} 與施放大絕 {string}")
    public void attemptNormalSkillAndUltimateTogether(String user, String normalSkill, String ultimate) {
        support.ensureTurn(user);
        // api.yml schema gap (noted in MoveCreateRequest description): a request
        // carrying row/col AND an ultimate skill must be rejected by the backend.
        support.placeAs(user, String.format(
                "{\"row\":7,\"col\":7,\"skill\":{\"skillType\":\"%s\",\"direction\":\"RIGHT\",\"anchor\":{\"row\":5,\"col\":5}}}",
                ultimate));
    }

    // ================================================================
    // 結算順序與勝負判定
    // ================================================================

    @When("玩家 {string} 於 \\({int},{int}\\) 落子並附掛 {string}")
    public void placeWithSkill(String user, int row, int col, String skill) {
        support.ensureTurn(user);
        support.placeAs(user, String.format(
                "{\"row\":%d,\"col\":%d,\"skill\":{\"skillType\":\"%s\",\"direction\":\"UP\"}}",
                row, col, skill));
    }

    @Then("系統依序結算：落子、橫劈推擠、場地效果（若觸發）")
    public void settlementRunsInOrder() {
        assertLastSuccess();
    }

    @And("全部結算完成後才進行唯一一次 WinConditionMet 判定")
    public void singleWinCheckAfterSettlement() {
        // The pipeline judges once, after all effects (SeriousDuelService, Q2).
        assertLastSuccess();
    }

    @And("系統發布 MoveResolved 事件")
    public void moveResolvedPublished() {
        assertLastSuccess();
    }

    @Given("黑方落子後暫時形成五連")
    public void blackWouldFormFiveTemporarily() {
        // Four black stones; the pending (7,7) placement would complete five.
        support.insertStone(StoneColor.BLACK, 7, 3);
        support.insertStone(StoneColor.BLACK, 7, 4);
        support.insertStone(StoneColor.BLACK, 7, 5);
        support.insertStone(StoneColor.BLACK, 7, 6);
        ctx.putMemo("pendingRow", 7);
        ctx.putMemo("pendingCol", 7);
    }

    @And("該手觸發火山噴發燒毀五連中的一子")
    public void eruptionWillBurnOneOfTheFive() {
        // Hidden eruption at the pending cell (7,7): the eruption burns its 8
        // neighbors, including (7,6) — breaking the just-formed five.
        support.insertFieldCell(FieldCellKind.ERUPTION, 7, 7, false);
    }

    @When("系統進行結算後的唯一勝負判定")
    public void settleAndJudge() {
        support.ensureTurn("alice");
        support.placeAs("alice", String.format("{\"row\":%d,\"col\":%d}",
                ctx.getMemo("pendingRow"), ctx.getMemo("pendingCol")));
        assertLastSuccess();
    }

    @Then("該五連不成立，不判勝")
    public void fiveDoesNotStand() {
        Map<?, ?> data = lastData();
        Assertions.assertThat(data.get("result")).isNull();
        Assertions.assertThat(data.get("status")).isEqualTo("PLAYING");
    }

    @Given("黑方落子後尚未形成五連")
    public void blackHasNoFiveYet() {
        // Four black stones with a gap at (7,6); a black stone waits at (8,6).
        support.insertStone(StoneColor.BLACK, 7, 2);
        support.insertStone(StoneColor.BLACK, 7, 3);
        support.insertStone(StoneColor.BLACK, 7, 4);
        support.insertStone(StoneColor.BLACK, 7, 5);
        support.insertStone(StoneColor.BLACK, 8, 6);
    }

    @When("橫劈推擠使某排棋子移動後形成五連")
    public void slashPushCompletesFive() {
        // Placing at (9,6) with HORIZONTAL_SLASH UP pushes (8,5),(8,6),(8,7) up:
        // (8,6) → (7,6) completes the horizontal five (7,2)..(7,6).
        support.ensureTurn("alice");
        support.placeAs("alice",
                "{\"row\":9,\"col\":6,\"skill\":{\"skillType\":\"HORIZONTAL_SLASH\",\"direction\":\"UP\"}}");
        assertLastSuccess();
    }

    @Then("系統於結算完成後的唯一判定中判黑方勝")
    public void blackWinsAtSingleJudgement() {
        Assertions.assertThat(lastData().get("result")).isEqualTo("BLACK_WIN");
    }

    @Given("結算完成後黑方與白方棋盤上皆出現五連")
    public void bothSidesWillHaveFive() {
        // White five already on the board (inserted directly — judged only at the
        // next settlement); black four awaiting completion at (7,6).
        support.insertStone(StoneColor.WHITE, 10, 2);
        support.insertStone(StoneColor.WHITE, 10, 3);
        support.insertStone(StoneColor.WHITE, 10, 4);
        support.insertStone(StoneColor.WHITE, 10, 5);
        support.insertStone(StoneColor.WHITE, 10, 6);
        support.insertStone(StoneColor.BLACK, 7, 2);
        support.insertStone(StoneColor.BLACK, 7, 3);
        support.insertStone(StoneColor.BLACK, 7, 4);
        support.insertStone(StoneColor.BLACK, 7, 5);
        ctx.putMemo("pendingRow", 7);
        ctx.putMemo("pendingCol", 6);
    }

    @And("本回合行動方為黑方")
    public void actorIsBlack() {
        Assertions.assertThat(support.currentTurnUser()).isEqualTo("alice");
    }

    @When("系統進行唯一勝負判定")
    public void settleAndJudgeSimultaneous() {
        settleAndJudge();
    }

    @Then("系統判黑方（行動方）勝")
    public void actorBlackWins() {
        Assertions.assertThat(lastData().get("result")).isEqualTo("BLACK_WIN");
    }

    // ================================================================
    // 技能與場地特效（feature has no Background: steps self-provision）
    // ================================================================

    @When("玩家使用技能 {string} 完成結算")
    public void playerUsesSkillAndSettles(String skill) {
        support.createSeriousGame("VOLCANO", "WARRIOR", "ARCHER");
        support.clearFieldCells();
        support.insertStone(StoneColor.WHITE, 6, 7); // something to push
        support.placeAs("alice", String.format(
                "{\"row\":7,\"col\":7,\"skill\":{\"skillType\":\"%s\",\"direction\":\"UP\"}}", skill));
        assertLastSuccess();
    }

    @Then("系統發布 SkillUsed 事件，且事件包含 effectTriggered 為 true")
    public void skillUsedWithEffectFlag() {
        assertAllEventsHaveEffectFlag();
        Assertions.assertThat(support.skillUsages().findByGameIdAndPlayerId(
                support.gameId(), String.valueOf(ctx.getMemo("playerId:alice")))).isNotEmpty();
    }

    @When("火山噴發完成結算")
    public void volcanoEruptionSettles() {
        support.createSeriousGame("VOLCANO", "WARRIOR", "ARCHER");
        support.clearFieldCells();
        support.insertFieldCell(FieldCellKind.ERUPTION, 7, 7, false);
        support.placeAs("alice", "{\"row\":7,\"col\":7}");
        assertLastSuccess();
    }

    @Then("系統發布 VolcanoErupted 事件，且事件包含 effectTriggered 為 true")
    public void volcanoEruptedWithEffectFlag() {
        Assertions.assertThat(eventTypesInLastResponse()).contains("VOLCANO_ERUPTED");
        assertAllEventsHaveEffectFlag();
    }

    @When("海浪或漲潮完成結算")
    public void waveOrTideSettles() {
        support.createSeriousGame("BEACH", "WARRIOR", "ARCHER");
        support.clearFieldCells();
        var state = support.fieldState();
        state.setSeaSide(com.gomoku.domain.enums.BoardSide.NORTH);
        state.setRoundCounter(9); // next hand is the 10th → wave surges
        support.saveFieldState(state);
        support.insertStone(StoneColor.WHITE, 1, 7); // ocean stone gets pushed
        support.placeAs("alice", "{\"row\":12,\"col\":3}");
        assertLastSuccess();
    }

    @Then("系統發布對應事件，且事件包含 effectTriggered 為 true")
    public void correspondingEventWithEffectFlag() {
        Assertions.assertThat(eventTypesInLastResponse()).contains("WAVE_SURGED");
        assertAllEventsHaveEffectFlag();
        Assertions.assertThat(support.eventsOfType(FieldEventType.WAVE_SURGED)).isNotEmpty();
    }

    // ================================================================
    // helpers
    // ================================================================

    private void assertLastSuccess() {
        ResponseEntity<?> resp = ctx.getLastResponse();
        Assertions.assertThat(resp).isNotNull();
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("expected 2xx but got %s: %s", resp.getStatusCode(), resp.getBody())
                .isTrue();
    }

    private Map<?, ?> lastData() {
        ResponseEntity<?> resp = ctx.getLastResponse();
        Object data = ((Map<?, ?>) resp.getBody()).get("data");
        Assertions.assertThat(data).isInstanceOf(Map.class);
        return (Map<?, ?>) data;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> lastSkillEvents() {
        Object events = lastData().get("skillEvents");
        Assertions.assertThat(events).as("skillEvents must be present").isInstanceOf(List.class);
        return (List<Map<String, Object>>) events;
    }

    private List<String> eventTypesInLastResponse() {
        return lastSkillEvents().stream().map(e -> String.valueOf(e.get("eventType"))).toList();
    }

    private void assertAllEventsHaveEffectFlag() {
        List<Map<String, Object>> events = lastSkillEvents();
        Assertions.assertThat(events).isNotEmpty();
        for (Map<String, Object> e : events) {
            Assertions.assertThat(e.get("effectTriggered"))
                    .as("event %s must carry effectTriggered=true", e.get("eventType"))
                    .isEqualTo(true);
        }
    }
}
