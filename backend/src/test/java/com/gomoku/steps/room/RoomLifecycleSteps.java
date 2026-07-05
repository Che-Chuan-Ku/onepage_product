package com.gomoku.steps.room;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.steps.common_given.CommonGiven;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

/**
 * Step definitions for 房間生命週期.feature — regression coverage for the room
 * lifecycle bug fix: an ONLINE game finishing must close its room (status →
 * FINISHED, drops out of the public lobby; see GameService#closeRoomIfOnline),
 * and a FINISHED room must reject toggleReady with 422 (RoomService#toggleReady).
 */
public class RoomLifecycleSteps {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ScenarioContext ctx;

    @Autowired
    private CommonGiven commonGiven;

    @Given("玩家 {string} 與 {string} 建立並加入一個公開線上房間")
    public void twoPlayersCreateAndJoinPublicRoom(String host, String guest) {
        commonGiven.playerIsLoggedIn(host);
        commonGiven.playerIsLoggedIn(guest);

        String body = "{\"visibility\":\"PUBLIC\",\"isSwap2Mode\":false}";
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> createResp = restTemplate.postForEntity(
                "/api/gmk/v1/rooms",
                new HttpEntity<>(body, commonGiven.authHeaders(host)),
                Map.class);
        Assertions.assertThat(createResp.getStatusCode().is2xxSuccessful())
                .as("room creation should succeed").isTrue();
        String roomId = (String) dataMap(createResp.getBody()).get("roomId");
        ctx.putMemo("roomId", roomId);
        ctx.putMemo("hostUsername", host);
        ctx.putMemo("guestUsername", guest);

        @SuppressWarnings("unchecked")
        ResponseEntity<Map> joinResp = restTemplate.postForEntity(
                "/api/gmk/v1/rooms/" + roomId + "/actions/join",
                new HttpEntity<>(null, commonGiven.authHeaders(guest)),
                Map.class);
        Assertions.assertThat(joinResp.getStatusCode().is2xxSuccessful())
                .as("guest join should succeed").isTrue();
    }

    @And("雙方皆已標記 Ready 並完成開局")
    public void bothPlayersReadyAndGameStarts() {
        String roomId = (String) ctx.getMemo("roomId");
        String host = (String) ctx.getMemo("hostUsername");
        String guest = (String) ctx.getMemo("guestUsername");

        restTemplate.postForEntity(
                "/api/gmk/v1/rooms/" + roomId + "/actions/toggle-ready",
                new HttpEntity<>(null, commonGiven.authHeaders(host)),
                Map.class);
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> readyResp = restTemplate.postForEntity(
                "/api/gmk/v1/rooms/" + roomId + "/actions/toggle-ready",
                new HttpEntity<>(null, commonGiven.authHeaders(guest)),
                Map.class);
        Assertions.assertThat(readyResp.getStatusCode().is2xxSuccessful())
                .as("second toggle-ready should reach READY").isTrue();

        // Standard (non-Swap2) startOnlineGame always assigns host=BLACK, guest=WHITE
        // (RoomService#startOnlineGame). Either player may call start-game (idempotent).
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> startResp = restTemplate.postForEntity(
                "/api/gmk/v1/rooms/" + roomId + "/actions/start-game",
                new HttpEntity<>(null, commonGiven.authHeaders(host)),
                Map.class);
        Assertions.assertThat(startResp.getStatusCode().is2xxSuccessful())
                .as("start-game should succeed once room is READY").isTrue();
        String gameId = (String) dataMap(startResp.getBody()).get("gameId");
        ctx.putMemo("gameId", gameId);
    }

    @When("黑方玩家於對局中連下五子獲勝")
    public void blackWinsFiveInARow() {
        String gameId = (String) ctx.getMemo("gameId");
        String host = (String) ctx.getMemo("hostUsername");   // BLACK
        String guest = (String) ctx.getMemo("guestUsername"); // WHITE

        for (int col = 0; col <= 4; col++) {
            ResponseEntity<Map> blackResp = moveAt(gameId, host, 7, col);
            ctx.setLastResponse(blackResp);
            if (isFinished(blackResp)) {
                break;
            }
            ResponseEntity<Map> whiteResp = moveAt(gameId, guest, 14, col);
            ctx.setLastResponse(whiteResp);
        }
    }

    private ResponseEntity<Map> moveAt(String gameId, String username, int row, int col) {
        String body = String.format("{\"row\":%d,\"col\":%d}", row, col);
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "/api/gmk/v1/games/" + gameId + "/moves",
                new HttpEntity<>(body, commonGiven.authHeaders(username)),
                Map.class);
        return resp;
    }

    private boolean isFinished(ResponseEntity<Map> resp) {
        if (resp.getBody() == null) {
            return false;
        }
        return "FINISHED".equals(dataMap(resp.getBody()).get("status"));
    }

    @Then("對局狀態為 {string}")
    public void gameStatusIs(String expected) {
        ResponseEntity<?> resp = ctx.getLastResponse();
        Assertions.assertThat(resp).as("must have a last response").isNotNull();
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        Assertions.assertThat(dataMap(resp.getBody()).get("status")).isEqualTo(expected);
    }

    @And("該房間狀態為 {string}")
    public void roomStatusIsExpected(String expected) {
        String roomId = (String) ctx.getMemo("roomId");
        String host = (String) ctx.getMemo("hostUsername");
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> resp = restTemplate.exchange(
                "/api/gmk/v1/rooms/" + roomId,
                HttpMethod.GET,
                new HttpEntity<>(null, commonGiven.authHeaders(host)),
                Map.class);
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        Assertions.assertThat(dataMap(resp.getBody()).get("status")).isEqualTo(expected);
    }

    @And("該房間不再出現在公開房間列表中")
    public void roomNoLongerInPublicList() {
        String roomId = (String) ctx.getMemo("roomId");
        String host = (String) ctx.getMemo("hostUsername");
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> listResp = restTemplate.exchange(
                "/api/gmk/v1/rooms",
                HttpMethod.GET,
                new HttpEntity<>(null, commonGiven.authHeaders(host)),
                Map.class);
        Assertions.assertThat(listResp.getStatusCode().is2xxSuccessful()).isTrue();
        Object dataObj = listResp.getBody().get("data");
        if (dataObj instanceof Map<?, ?> pageData) {
            Object items = pageData.get("items");
            if (items instanceof List<?> list) {
                boolean found = list.stream().anyMatch(item ->
                        item instanceof Map<?, ?> m && roomId.equals(m.get("roomId")));
                Assertions.assertThat(found)
                        .as("FINISHED room %s should not appear in public room list", roomId)
                        .isFalse();
            }
        }
    }

    @When("玩家 {string} 嘗試切換 Ready")
    public void playerAttemptsToggleReady(String username) {
        String roomId = (String) ctx.getMemo("roomId");
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "/api/gmk/v1/rooms/" + roomId + "/actions/toggle-ready",
                new HttpEntity<>(null, commonGiven.authHeaders(username)),
                Map.class);
        ctx.setLastResponse(resp);
    }

    @Then("回應狀態碼為 422")
    public void responseStatusIs422() {
        Assertions.assertThat(ctx.getLastResponse().getStatusCode().value()).isEqualTo(422);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> dataMap(Object body) {
        if (body instanceof Map<?, ?> m) {
            Object dataObj = m.get("data");
            if (dataObj instanceof Map<?, ?> data) {
                return (Map<String, Object>) data;
            }
        }
        return Map.of();
    }
}
