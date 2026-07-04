package com.gomoku.steps.serious;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.steps.common_given.CommonGiven;
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
 * Steps for 真劍勝負房間建立與場地選擇.feature and 職業選擇與鎖定.feature.
 * Symbolic room codes like "ABC123" refer to the memoized serious room.
 */
public class SeriousRoomSteps {

    @Autowired
    private ScenarioContext ctx;
    @Autowired
    private CommonGiven commonGiven;
    @Autowired
    private SeriousCommonSteps support;

    private String roomId() {
        Object id = ctx.getMemo("seriousRoomId");
        Assertions.assertThat(id).as("serious room must exist").isNotNull();
        return id.toString();
    }

    private Map<?, ?> createRoom(String user, String body) {
        commonGiven.playerIsLoggedIn(user);
        Map<?, ?> data = support.postAs(user, "/api/gmk/v1/rooms", body);
        if (data != null && data.get("roomId") != null) {
            ctx.putMemo("seriousRoomId", data.get("roomId"));
        }
        return data;
    }

    // ================================================================
    // 真劍勝負房間建立與場地選擇
    // ================================================================

    @When("玩家 {string} 建立房間，選擇 {string} 模式並指定場地 {string}")
    public void createSeriousRoomWithField(String user, String mode, String fieldType) {
        createRoom(user, String.format(
                "{\"visibility\":\"PUBLIC\",\"battleMode\":\"SERIOUS_DUEL\",\"fieldType\":\"%s\"}",
                fieldType));
    }

    @Then("該房間 battleMode 為 {string}")
    public void roomBattleModeIs(String battleMode) {
        Assertions.assertThat(lastData().get("battleMode")).isEqualTo(battleMode);
    }

    @Then("該房間 fieldType 為 {string}")
    public void roomFieldTypeIs(String fieldType) {
        Assertions.assertThat(lastData().get("fieldType")).isEqualTo(fieldType);
    }

    @When("玩家 {string} 嘗試建立房間並同時啟用 {string} 與 {string}")
    public void createRoomWithSeriousAndSwap2(String user, String a, String b) {
        createRoom(user,
                "{\"visibility\":\"PUBLIC\",\"battleMode\":\"SERIOUS_DUEL\",\"fieldType\":\"VOLCANO\",\"isSwap2Mode\":true}");
    }

    @When("玩家 {string} 嘗試建立 {string} 房間但未指定場地")
    public void createSeriousRoomWithoutField(String user, String mode) {
        createRoom(user, "{\"visibility\":\"PUBLIC\",\"battleMode\":\"SERIOUS_DUEL\"}");
    }

    @Then("回應 HTTP 狀態碼為 422（對應 POST \\/rooms 422 UnprocessableEntity）")
    public void responseStatusIs422() {
        ResponseEntity<?> resp = ctx.getLastResponse();
        Assertions.assertThat(resp.getStatusCode().value()).isEqualTo(422);
    }

    @Given("房間 {string} 為真劍勝負模式，場地為 {string}")
    public void seriousRoomWithField(String roomCode, String fieldType) {
        commonGiven.playerIsLoggedIn("alice");
        commonGiven.playerIsLoggedIn("bob");
        createRoom("alice", String.format(
                "{\"visibility\":\"PUBLIC\",\"battleMode\":\"SERIOUS_DUEL\",\"fieldType\":\"%s\"}",
                fieldType));
        support.postAs("bob", "/api/gmk/v1/rooms/" + roomId() + "/actions/join", null);
    }

    @When("雙方對戰玩家皆標記 Ready")
    public void bothPlayersReady() {
        support.postAs("alice", "/api/gmk/v1/rooms/" + roomId() + "/actions/toggle-ready", null);
        support.postAs("bob", "/api/gmk/v1/rooms/" + roomId() + "/actions/toggle-ready", null);
    }

    @Then("系統進入投擲硬幣流程決定黑白")
    public void systemEntersCoinTossFlow() {
        // Backend equivalent of the coin-toss flow for a non-Swap2 room: the game
        // starts directly in PLAYING with colors assigned (see startOnlineGame).
        // REST response is GameDetailResponse (api.yml:423-437, 201 Created);
        // colour assignment (blackPlayerId/whitePlayerId) is carried only on the
        // GameStartedEvent WS broadcast, so it is asserted via the persisted Game.
        Map<?, ?> started = support.postAs("alice",
                "/api/gmk/v1/rooms/" + roomId() + "/actions/start-game", null);
        Assertions.assertThat(((ResponseEntity<?>) ctx.getLastResponse()).getStatusCode().value())
                .as("startGame must return 201 Created")
                .isEqualTo(201);
        Assertions.assertThat(started).isNotNull();
        Assertions.assertThat(started.get("gameMode")).as("GameDetailResponse.gameMode").isNotNull();
        Assertions.assertThat(started.get("currentTurn")).as("GameDetailResponse.currentTurn").isNotNull();
        ctx.putMemo("seriousGameId", started.get("gameId"));
        Assertions.assertThat(started.get("status")).isEqualTo("PLAYING");
        Assertions.assertThat(support.requireGame().getBlackPlayerId()).isNotNull();
        Assertions.assertThat(support.requireGame().getWhitePlayerId()).isNotNull();
    }

    @And("不進入 Swap2 開局流程")
    public void doesNotEnterSwap2Opening() {
        Assertions.assertThat(support.requireGame().isUseSwap2()).isFalse();
        Assertions.assertThat(support.requireGame().getStatus().name()).isNotEqualTo("OPENING");
    }

    @When("玩家於本地雙人模式嘗試啟用 {string}")
    public void localModeAttemptsSeriousDuel(String mode) {
        // LocalGameCreateRequest (api.yml) intentionally has no battleMode — the
        // local serious duel is deferred (req #48). Creating a local game can
        // therefore never enable serious duel.
        support.postAs("alice", "/api/gmk/v1/games",
                "{\"useSwap2\":false,\"blackNickname\":\"甲\",\"whiteNickname\":\"乙\"}");
    }

    @Then("系統標示為第二波後補功能（Could，需求 #48）")
    public void markedAsSecondWave() {
        // Behavioral mapping: the created local game is always NORMAL mode.
        Assertions.assertThat(lastData().get("battleMode")).isEqualTo("NORMAL");
    }

    @Then("系統標示該功能為 {string}")
    public void systemMarksFeatureAs(String label) {
        Assertions.assertThat(lastData().get("battleMode")).isEqualTo("NORMAL");
    }

    @And("不進入真劍勝負對局流程")
    public void doesNotEnterSeriousDuelFlow() {
        Assertions.assertThat(lastData().get("battleMode")).isEqualTo("NORMAL");
    }

    // ================================================================
    // 職業選擇與鎖定
    // ================================================================

    @Given("房間 {string} 為真劍勝負模式")
    public void seriousRoom(String roomCode) {
        commonGiven.playerIsLoggedIn("alice");
        createRoom("alice",
                "{\"visibility\":\"PUBLIC\",\"battleMode\":\"SERIOUS_DUEL\",\"fieldType\":\"VOLCANO\"}");
    }

    @And("對戰玩家為 {string} 與 {string}")
    public void duelPlayersAre(String p1, String p2) {
        commonGiven.playerIsLoggedIn(p2);
        support.postAs(p2, "/api/gmk/v1/rooms/" + roomId() + "/actions/join", null);
    }

    @When("玩家 {string} 選擇職業 {string}")
    public void playerSelectsClass(String user, String classType) {
        support.postAs(user, "/api/gmk/v1/rooms/" + roomId() + "/actions/select-class",
                "{\"classType\":\"" + classType + "\"}");
        ctx.putMemo("lastSelectStatus:" + user,
                ((ResponseEntity<?>) ctx.getLastResponse()).getStatusCode().value());
    }

    @Then("系統發布 ClassSelected 事件")
    public void classSelectedPublished() {
        Assertions.assertThat(((ResponseEntity<?>) ctx.getLastResponse())
                .getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Given("玩家 {string} 已選擇職業 {string}")
    public void playerHasSelectedClass(String user, String classType) {
        playerSelectsClass(user, classType);
        classSelectedPublished();
    }

    @When("玩家 {string} 改選職業 {string}")
    public void playerChangesClass(String user, String classType) {
        playerSelectsClass(user, classType);
    }

    @Then("玩家 {string} 的職業更新為 {string}")
    public void playerClassUpdatedTo(String user, String classType) {
        Assertions.assertThat(memberClassSeenBy(user, user)).isEqualTo(classType);
    }

    @Given("玩家 {string} 已標記 Ready 且職業已鎖定")
    public void playerReadyAndClassLocked(String user) {
        playerSelectsClass(user, "WARRIOR");
        support.postAs(user, "/api/gmk/v1/rooms/" + roomId() + "/actions/toggle-ready", null);
    }

    @When("玩家 {string} 嘗試變更職業")
    public void playerAttemptsToChangeClass(String user) {
        playerSelectsClass(user, "ARCHER");
    }

    @Then("兩者皆操作成功")
    public void bothOperationsSucceeded() {
        Assertions.assertThat(ctx.getMemo("lastSelectStatus:alice")).isEqualTo(200);
        Assertions.assertThat(ctx.getMemo("lastSelectStatus:bob")).isEqualTo(200);
    }

    @When("玩家 {string} 查詢房間資訊")
    public void playerQueriesRoom(String user) {
        support.getAs(user, "/api/gmk/v1/rooms/" + roomId());
    }

    @Then("{string} 的職業欄位對 {string} 顯示為隱藏（null）")
    public void classHiddenFromOpponent(String owner, String viewer) {
        Assertions.assertThat(memberClassSeenBy(viewer, owner)).isNull();
    }

    @Given("{string} 為房間 {string} 的觀戰者")
    public void userIsSpectator(String user, String roomCode) {
        commonGiven.playerIsLoggedIn(user);
        Map<?, ?> data = support.postAs(user, "/api/gmk/v1/rooms/" + roomId() + "/actions/join", null);
        Assertions.assertThat(data).isNotNull();
        Assertions.assertThat(data.get("joinedAsRole")).isEqualTo("SPECTATOR");
    }

    @And("玩家 {string} 已選擇職業 {string}，玩家 {string} 尚未選擇")
    public void oneSelectedOneNot(String selected, String classType, String notSelected) {
        playerSelectsClass(selected, classType);
    }

    @When("{string} 查詢房間資訊")
    public void spectatorQueriesRoom(String user) {
        support.getAs(user, "/api/gmk/v1/rooms/" + roomId());
    }

    @Then("{string} 可見 {string} 的職業為 {string}")
    public void viewerSeesClass(String viewer, String owner, String classType) {
        Assertions.assertThat(memberClassSeenBy(viewer, owner)).isEqualTo(classType);
    }

    @And("「選擇階段對手不可見」（Q8）僅適用於對戰雙方彼此之間，不適用於觀戰者")
    public void visibilityRuleAppliesOnlyBetweenPlayers() {
        // Documented rule (R2-2) — behaviour asserted by the preceding step.
    }

    @Given("玩家 {string} 選擇 {string}、玩家 {string} 選擇 {string}")
    public void bothPlayersSelect(String p1, String c1, String p2, String c2) {
        playerSelectsClass(p1, c1);
        playerSelectsClass(p2, c2);
    }

    @When("雙方皆標記 Ready 且對局進入 PLAYING 狀態")
    public void bothReadyAndGamePlaying() {
        support.postAs("alice", "/api/gmk/v1/rooms/" + roomId() + "/actions/toggle-ready", null);
        support.postAs("bob", "/api/gmk/v1/rooms/" + roomId() + "/actions/toggle-ready", null);
        Map<?, ?> started = support.postAs("alice",
                "/api/gmk/v1/rooms/" + roomId() + "/actions/start-game", null);
        Assertions.assertThat(((ResponseEntity<?>) ctx.getLastResponse()).getStatusCode().value())
                .as("startGame must return 201 Created")
                .isEqualTo(201);
        Assertions.assertThat(started).isNotNull();
        Assertions.assertThat(started.get("gameMode")).as("GameDetailResponse.gameMode").isNotNull();
        Assertions.assertThat(started.get("currentTurn")).as("GameDetailResponse.currentTurn").isNotNull();
        ctx.putMemo("seriousGameId", started.get("gameId"));
        Assertions.assertThat(started.get("status")).isEqualTo("PLAYING");
    }

    @Then("系統發布 ClassesRevealed 事件")
    public void classesRevealedPublished() {
        // Reveal point = game turned PLAYING (req #35): game state carries both classes.
        Map<?, ?> state = support.getAs("alice",
                "/api/gmk/v1/games/" + ctx.getMemo("seriousGameId"));
        Assertions.assertThat(state).isNotNull();
        Assertions.assertThat(state.get("blackClass")).isNotNull();
        Assertions.assertThat(state.get("whiteClass")).isNotNull();
    }

    @And("雙方玩家皆可見對方最終職業")
    public void bothPlayersSeeEachOthersClass() {
        Assertions.assertThat(memberClassSeenBy("bob", "alice")).isNotNull();
        Assertions.assertThat(memberClassSeenBy("alice", "bob")).isNotNull();
    }

    @And("觀戰者亦同時可見雙方最終職業（R2-2）")
    public void spectatorSeesBothClasses() {
        commonGiven.playerIsLoggedIn("carol");
        support.postAs("carol", "/api/gmk/v1/rooms/" + roomId() + "/actions/join", null);
        Assertions.assertThat(memberClassSeenBy("carol", "alice")).isNotNull();
        Assertions.assertThat(memberClassSeenBy("carol", "bob")).isNotNull();
    }

    // ================================================================
    // helpers
    // ================================================================

    private Map<?, ?> lastData() {
        ResponseEntity<?> resp = ctx.getLastResponse();
        Assertions.assertThat(resp).isNotNull();
        Assertions.assertThat(resp.getBody()).isInstanceOf(Map.class);
        Object data = ((Map<?, ?>) resp.getBody()).get("data");
        Assertions.assertThat(data).isInstanceOf(Map.class);
        return (Map<?, ?>) data;
    }

    /** The classType of {@code owner}'s member entry as seen by {@code viewer} via GET room. */
    private Object memberClassSeenBy(String viewer, String owner) {
        Map<?, ?> room = support.getAs(viewer, "/api/gmk/v1/rooms/" + roomId());
        Assertions.assertThat(room).isNotNull();
        String ownerId = String.valueOf(ctx.getMemo("playerId:" + owner));
        List<?> members = (List<?>) room.get("members");
        for (Object m : members) {
            Map<?, ?> member = (Map<?, ?>) m;
            if (ownerId.equals(member.get("playerId"))) {
                return member.get("classType");
            }
        }
        throw new AssertionError("member not found: " + owner);
    }
}
