package com.gomoku.steps.serious;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.FieldEvent;
import com.gomoku.domain.entity.FieldState;
import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.FieldEventType;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.game.FieldEventDetail;
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
 * Steps for 火山場地 / 沙灘場地 / 海浪與漲潮結算 / 隱藏格資訊管理, plus the Serious
 * Duel additions to 連線管理與斷線判負 (req #46) and 查看遊戲歷史與回放 (req #47).
 */
public class SeriousFieldSteps {

    @Autowired
    private ScenarioContext ctx;
    @Autowired
    private SeriousCommonSteps support;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ================================================================
    // 火山場地
    // ================================================================

    @When("系統生成火山場地")
    public void volcanoFieldGenerated() {
        // Generation already happened at game start (startOnlineGame); snapshot it.
        ctx.putMemo("obstacleCount", support.fieldCells()
                .findByGameIdAndCellKindAndDeletedFalse(support.gameId(), FieldCellKind.OBSTACLE).size());
        ctx.putMemo("eruptionCount", support.fieldCells()
                .findByGameIdAndCellKindAndDeletedFalse(support.gameId(), FieldCellKind.ERUPTION).size());
    }

    @Then("系統生成 5 至 8 個障礙物格")
    public void obstacleCountBetween5And8() {
        Assertions.assertThat((Integer) ctx.getMemo("obstacleCount")).isBetween(5, 8);
    }

    @And("雙方玩家皆可見障礙物位置")
    public void bothPlayersSeeObstacles() {
        int count = (Integer) ctx.getMemo("obstacleCount");
        for (String user : new String[]{"alice", "bob"}) {
            Map<?, ?> state = support.getAs(user, "/api/gmk/v1/games/" + support.gameId());
            Map<?, ?> fieldState = (Map<?, ?>) state.get("fieldState");
            Assertions.assertThat((List<?>) fieldState.get("obstacles")).hasSize(count);
        }
    }

    @And("系統發布 FieldGenerated 事件")
    public void fieldGeneratedPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.FIELD_GENERATED)).isNotEmpty();
    }

    @Given("\\({int},{int}\\) 為障礙物格")
    public void cellIsObstacle(int row, int col) {
        support.clearFieldCells();
        support.insertFieldCell(FieldCellKind.OBSTACLE, row, col, true);
    }

    @When("玩家嘗試在 \\({int},{int}\\) 落子")
    public void playerAttemptsMove(int row, int col) {
        support.placeAs(support.currentTurnUser(),
                String.format("{\"row\":%d,\"col\":%d}", row, col));
    }

    @Then("系統生成最多 5 個噴發格")
    public void atMost5EruptionCells() {
        Assertions.assertThat((Integer) ctx.getMemo("eruptionCount")).isBetween(1, 5);
    }

    @And("噴發格位置不下發給任一玩家")
    public void eruptionCellsNotSentToPlayers() {
        assertHiddenCellsNotExposed();
    }

    @Given("\\({int},{int}\\) 為隱藏噴發格")
    public void cellIsHiddenEruption(int row, int col) {
        support.clearFieldCells();
        support.insertFieldCell(FieldCellKind.ERUPTION, row, col, false);
    }

    @And("\\({int},{int}\\),\\({int},{int}\\),\\({int},{int}\\) 各有一顆棋子")
    public void threeCellsHaveStones(int r1, int c1, int r2, int c2, int r3, int c3) {
        support.insertStone(StoneColor.WHITE, r1, c1);
        support.insertStone(StoneColor.WHITE, r2, c2);
        support.insertStone(StoneColor.WHITE, r3, c3);
    }

    @When("玩家於 \\({int},{int}\\) 落子")
    public void playerPlacesAt(int row, int col) {
        support.placeAs(support.currentTurnUser(),
                String.format("{\"row\":%d,\"col\":%d}", row, col));
    }

    @Then("系統發布 VolcanoErupted 事件")
    public void volcanoEruptedPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.VOLCANO_ERUPTED)).isNotEmpty();
    }

    @And("系統發布 StonesBurned 事件，燒毀 \\({int},{int}\\),\\({int},{int}\\),\\({int},{int}\\) 上的棋子")
    public void stonesBurnedPublished(int r1, int c1, int r2, int c2, int r3, int c3) {
        List<FieldEvent> events = support.eventsOfType(FieldEventType.STONES_BURNED);
        Assertions.assertThat(events).isNotEmpty();
        FieldEventDetail detail = parseDetail(events.get(events.size() - 1));
        int[][] burned = {{r1, c1}, {r2, c2}, {r3, c3}};
        for (int[] cell : burned) {
            boolean found = detail.cells().stream().anyMatch(d ->
                    d.row() == cell[0] && d.col() == cell[1]);
            Assertions.assertThat(found)
                    .as("stone (%d,%d) must be burned", cell[0], cell[1]).isTrue();
            Assertions.assertThat(support.stoneColorAt(cell[0], cell[1])).isNull();
        }
    }

    @And("\\({int},{int}\\) 上觸發者的棋子保留")
    public void triggerStoneKept(int row, int col) {
        Assertions.assertThat(support.stoneColorAt(row, col))
                .as("trigger stone must be kept (Q5)").isNotNull();
    }

    @Given("\\({int},{int}\\) 剛觸發噴發")
    public void cellJustErupted(int row, int col) {
        support.clearFieldCells();
        support.insertFieldCell(FieldCellKind.ERUPTION, row, col, false);
        support.insertStone(StoneColor.WHITE, row - 1, col - 1); // will be burned
        support.placeAs(support.currentTurnUser(),
                String.format("{\"row\":%d,\"col\":%d}", row, col));
        assertLastSuccess();
        ctx.putMemo("burnedRow", row - 1);
        ctx.putMemo("burnedCol", col - 1);
    }

    @When("之後有玩家於周邊被燒毀的格子嘗試落子")
    public void placeOnBurnedNeighbor() {
        support.placeAs(support.currentTurnUser(), String.format(
                "{\"row\":%d,\"col\":%d}", ctx.getMemo("burnedRow"), ctx.getMemo("burnedCol")));
    }

    @Then("操作成功（該格已為普通格）")
    public void moveSucceedsCellIsNormal() {
        assertLastSuccess();
    }

    // ================================================================
    // 沙灘場地
    // ================================================================

    @When("系統生成沙灘場地")
    public void beachFieldGenerated() {
        ctx.putMemo("tideCount", support.fieldCells()
                .findByGameIdAndCellKindAndDeletedFalse(support.gameId(), FieldCellKind.TIDE).size());
    }

    @Then("棋盤尺寸為 16×16（列與欄索引 0..15）")
    public void boardIs16x16() {
        // (15,15) only exists on the 16x16 beach board.
        support.placeAs(support.currentTurnUser(), "{\"row\":15,\"col\":15}");
        assertLastSuccess();
    }

    @Then("海洋格佔 8 排，沙灘格佔 8 排")
    public void oceanAndSandHalfHalf() {
        FieldState state = support.fieldState();
        Assertions.assertThat(state.getErodedRows()).isZero();
        Assertions.assertThat(state.getSeaSide()).isNotNull();
    }

    @And("海洋起始側為 {string} \\/ {string} \\/ {string} \\/ {string} 之一（隨機決定）")
    public void seaSideIsOneOf(String s1, String s2, String s3, String s4) {
        Assertions.assertThat(support.fieldState().getSeaSide().name()).isIn(s1, s2, s3, s4);
    }

    @Given("\\({int},{int}\\) 為海洋格")
    public void cellIsOcean(int row, int col) {
        support.clearFieldCells();
        FieldState state = support.fieldState();
        state.setSeaSide(BoardSide.NORTH); // rows 0..7 are ocean → (0,7) is ocean
        support.saveFieldState(state);
    }

    @Then("操作成功（海洋格可正常落子）")
    public void moveSucceedsOnOcean() {
        assertLastSuccess();
    }

    @Then("系統生成最多 5 個隱藏漲潮格")
    public void atMost5TideCells() {
        Assertions.assertThat((Integer) ctx.getMemo("tideCount")).isBetween(1, 5);
    }

    @And("漲潮格位置不下發給任一玩家")
    public void tideCellsNotSentToPlayers() {
        assertHiddenCellsNotExposed();
    }

    @Given("\\({int},{int}\\) 為隱藏漲潮格")
    public void cellIsHiddenTide(int row, int col) {
        support.clearFieldCells();
        support.insertFieldCell(FieldCellKind.TIDE, row, col, false);
    }

    @Then("系統發布 TideTriggered 事件")
    public void tideTriggeredPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.TIDE_TRIGGERED)).isNotEmpty();
        Assertions.assertThat(support.fieldState().isTideTriggered()).isTrue();
    }

    @And("之後每次海浪（見需求 #41）額外侵蝕最靠海一排沙灘")
    public void subsequentWavesErode() {
        // Behaviour asserted in 海浪與漲潮結算; here confirm the persisted flag.
        Assertions.assertThat(support.fieldState().isTideTriggered()).isTrue();
    }

    // ================================================================
    // 海浪與漲潮結算
    // ================================================================

    @Given("對局回合計數器累積滿 5 輪（雙方各下一手，合計 10 手）")
    public void roundCounterAt5Rounds() {
        prepareBeach(BoardSide.NORTH, false, 0);
    }

    @When("第 10 手結算完成")
    public void tenthHandSettles() {
        playOneHand();
    }

    @Then("系統發布 WaveSurged 事件")
    public void waveSurgedPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.WAVE_SURGED)).isNotEmpty();
    }

    @And("回合計數器歸零重新累積")
    public void roundCounterReset() {
        Assertions.assertThat(support.fieldState().getRoundCounter()).isZero();
    }

    @Given("海洋格 \\({int},{int}\\) 上有一顆棋子，沙灘在南側方向")
    public void oceanStoneWithSandSouth(int row, int col) {
        prepareBeach(BoardSide.NORTH, false, 0); // sea north → sand south
        support.insertStone(StoneColor.WHITE, row, col);
        ctx.putMemo("oceanStoneRow", row);
        ctx.putMemo("oceanStoneCol", col);
    }

    @When("海浪觸發")
    public void waveTriggers() {
        playOneHand();
    }

    @Then("該棋子依推擠解算器規則往沙灘方向推 1 格")
    public void stonePushedTowardSand() {
        int row = (Integer) ctx.getMemo("oceanStoneRow");
        int col = (Integer) ctx.getMemo("oceanStoneCol");
        boolean found = support.eventsOfType(FieldEventType.STONE_PUSHED).stream()
                .map(this::parseDetail)
                .anyMatch(d -> d.fromRow() == row && d.fromCol() == col
                        && d.toRow() == row + 1 && d.toCol() == col);
        Assertions.assertThat(found).as("ocean stone must be pushed 1 cell toward sand").isTrue();
    }

    @Given("漲潮已被觸發（TideTriggered）")
    public void tideAlreadyTriggered() {
        prepareBeach(BoardSide.NORTH, true, 0);
    }

    @When("下一次 WaveSurged 發生")
    public void nextWaveSurges() {
        playOneHand();
    }

    @Then("系統將最靠海一排沙灘格轉為海洋格")
    public void seawardSandLineEroded() {
        Assertions.assertThat(support.fieldState().getErodedRows()).isEqualTo(1);
    }

    @And("系統發布 SandEroded 事件")
    public void sandErodedPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.SAND_ERODED)).isNotEmpty();
    }

    @And("系統發布 TideRisen 事件")
    public void tideRisenPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.TIDE_RISEN)).isNotEmpty();
    }

    @Given("沙灘格 \\({int},{int}\\) 上有一顆棋子，該格剛被侵蝕為海洋格")
    public void erodedSandCellWithStone(int row, int col) {
        // Sea NORTH + 1 eroded row → row 8 has just become ocean.
        prepareBeach(BoardSide.NORTH, true, 1);
        support.insertStone(StoneColor.WHITE, row, col);
        ctx.putMemo("oceanStoneRow", row);
        ctx.putMemo("oceanStoneCol", col);
    }

    @When("下一次海浪觸發")
    public void nextWaveTriggers() {
        playOneHand();
    }

    @Then("\\({int},{int}\\) 上的棋子比照海洋格棋子，依海浪方向被推擠")
    public void erodedCellStonePushedLikeOcean(int row, int col) {
        boolean found = support.eventsOfType(FieldEventType.STONE_PUSHED).stream()
                .map(this::parseDetail)
                .anyMatch(d -> d.fromRow() == row && d.fromCol() == col);
        Assertions.assertThat(found)
                .as("stone on the eroded cell must be wave-pushed").isTrue();
    }

    @Given("漲潮已觸發且經過多次 WaveSurged")
    public void tideTriggeredAndManyWaves() {
        prepareBeach(BoardSide.NORTH, true, 7);
    }

    @When("所有沙灘排皆已被侵蝕")
    public void allSandErodedAfterWave() {
        playOneHand(); // erodes the last sand line (7 → 8)
    }

    @Then("棋盤全數格子皆為海洋格")
    public void wholeBoardIsOcean() {
        Assertions.assertThat(support.fieldState().getErodedRows()).isEqualTo(8);
    }

    @And("後續海浪僅推擠棋子，不再有沙灘可侵蝕")
    public void furtherWavesOnlyPush() {
        int erosionEvents = support.eventsOfType(FieldEventType.SAND_ERODED).size();
        // Trigger one more wave: erodedRows must stay 8, no further SAND_ERODED.
        FieldState state = support.fieldState();
        state.setRoundCounter(9);
        support.saveFieldState(state);
        playOneHand();
        Assertions.assertThat(support.eventsOfType(FieldEventType.WAVE_SURGED).size())
                .isGreaterThanOrEqualTo(2);
        Assertions.assertThat(support.fieldState().getErodedRows()).isEqualTo(8);
        Assertions.assertThat(support.eventsOfType(FieldEventType.SAND_ERODED))
                .hasSize(erosionEvents);
    }

    // ================================================================
    // 隱藏格資訊管理
    // ================================================================

    @When("玩家查詢目前對局狀態")
    public void playerQueriesGameState() {
        support.getAs("alice", "/api/gmk/v1/games/" + support.gameId());
    }

    @Then("回應中不包含尚未觸發的隱藏格位置")
    public void responseContainsNoUntriggeredHiddenCells() {
        assertHiddenCellsNotExposed();
    }

    @Given("{string} 為該對局的觀戰者")
    public void userIsGameSpectator(String user) {
        support.common().playerIsLoggedIn(user);
        Map<?, ?> data = support.postAs(user,
                "/api/gmk/v1/rooms/" + ctx.getMemo("seriousRoomId") + "/actions/join", null);
        Assertions.assertThat(data.get("joinedAsRole")).isEqualTo("SPECTATOR");
    }

    @When("{string} 查詢對局狀態")
    public void namedUserQueriesGameState(String user) {
        support.getAs(user, "/api/gmk/v1/games/" + support.gameId());
    }

    @Given("\\({int},{int}\\) 為隱藏噴發格且尚未觸發")
    public void hiddenUntriggeredEruption(int row, int col) {
        support.clearFieldCells();
        support.insertFieldCell(FieldCellKind.ERUPTION, row, col, false);
    }

    @When("玩家於 \\({int},{int}\\) 落子觸發噴發")
    public void playerTriggersEruption(int row, int col) {
        support.placeAs(support.currentTurnUser(),
                String.format("{\"row\":%d,\"col\":%d}", row, col));
        assertLastSuccess();
    }

    @Then("系統發布 VolcanoErupted 事件，內含 \\({int},{int}\\) 位置")
    public void volcanoEruptedWithPosition(int row, int col) {
        List<FieldEvent> events = support.eventsOfType(FieldEventType.VOLCANO_ERUPTED);
        Assertions.assertThat(events).isNotEmpty();
        FieldEvent last = events.get(events.size() - 1);
        Assertions.assertThat(last.getRow()).isEqualTo(row);
        Assertions.assertThat(last.getCol()).isEqualTo(col);
    }

    @And("該格位置自此對雙方與觀戰者皆可見")
    public void cellVisibleToEveryoneFromNow() {
        for (String user : new String[]{"alice", "bob"}) {
            Map<?, ?> state = support.getAs(user, "/api/gmk/v1/games/" + support.gameId());
            List<?> revealed = (List<?>) state.get("revealedHiddenCells");
            Assertions.assertThat(revealed).isNotEmpty();
        }
    }

    // ================================================================
    // 連線管理與斷線判負 — Serious Duel reconnect (req #46)
    // ================================================================

    @Given("玩家 {string} 於真劍勝負對局（場地 {string}）中斷線")
    public void playerDisconnectedInSeriousDuel(String player, String fieldType) {
        support.createSeriousGame(fieldType, "WARRIOR", "ARCHER");
        // Mirror ConnectionSteps' disconnect memo contract (REST-level proxy).
        ctx.putMemo("disconnectedPlayer", player);
        ctx.putMemo("disconnectTime", System.currentTimeMillis());
        ctx.putMemo("gracePeriodPlayer", player);
        ctx.putMemo("gracePeriodStarted", true);
    }

    @And("斷線前 {string} 已使用技能 {string}，場地已生成障礙物與已觸發噴發格")
    public void beforeDisconnectSkillUsedAndEruptionTriggered(String player, String skill) {
        // Obstacles were generated at game start; keep them (assert non-empty).
        Assertions.assertThat(support.fieldCells()
                        .findByGameIdAndCellKindAndDeletedFalse(support.gameId(), FieldCellKind.OBSTACLE))
                .isNotEmpty();
        // Plant an eruption cell at (7,7) (replacing any generated cell there),
        // then let the player trigger it with the slash attached — one hand
        // records the skill usage AND reveals the eruption cell.
        support.insertFieldCell(FieldCellKind.ERUPTION, 7, 7, false);
        support.ensureTurn(player);
        support.placeAs(player, String.format(
                "{\"row\":7,\"col\":7,\"skill\":{\"skillType\":\"%s\",\"direction\":\"UP\"}}", skill));
        assertLastSuccess();
        ctx.putMemo("expectedRoundCounter", support.fieldState().getRoundCounter());
    }

    @And("{string} 的技能已用狀態（HORIZONTAL_SLASH 已用）隨對局狀態恢復")
    public void skillUsageRestoredAfterReconnect(String player) {
        Assertions.assertThat(support.skillUsageRecorded(SkillType.HORIZONTAL_SLASH))
                .as("skill usage must survive reconnect (server-side state)").isTrue();
        // Reusing the same skill after reconnect is still rejected.
        support.ensureTurn(player); // opponent filler hand advances the counter
        support.placeAs(player,
                "{\"row\":12,\"col\":12,\"skill\":{\"skillType\":\"HORIZONTAL_SLASH\",\"direction\":\"UP\"}}");
        ResponseEntity<?> resp = ctx.getLastResponse();
        Assertions.assertThat(resp.getStatusCode().value()).isEqualTo(422);
        // Refresh the expected counter — the filler hand above legitimately bumped it.
        ctx.putMemo("expectedRoundCounter", support.fieldState().getRoundCounter());
    }

    @And("場地狀態（障礙物、已觸發噴發格、回合計數）隨對局狀態恢復")
    public void fieldStateRestoredAfterReconnect() {
        Map<?, ?> state = support.getAs("alice", "/api/gmk/v1/games/" + support.gameId());
        Map<?, ?> fieldState = (Map<?, ?>) state.get("fieldState");
        Assertions.assertThat((List<?>) fieldState.get("obstacles")).isNotEmpty();
        List<?> revealed = (List<?>) state.get("revealedHiddenCells");
        Assertions.assertThat(revealed).isNotEmpty();
        Assertions.assertThat(fieldState.get("roundCounter"))
                .isEqualTo(ctx.getMemo("expectedRoundCounter"));
    }

    // ================================================================
    // 查看遊戲歷史與回放 — Serious Duel replay (req #47)
    // ================================================================

    @Given("對局 {string} 為真劍勝負模式（場地 {string}）並已結束")
    public void finishedSeriousDuelGame(String specGameId, String fieldType) {
        support.createSeriousGame(fieldType, "WARRIOR", "ARCHER");
        support.clearFieldCells();
        FieldState state = support.fieldState();
        state.setSeaSide(BoardSide.NORTH);
        support.saveFieldState(state);
        support.insertFieldCell(FieldCellKind.TIDE, 10, 10, false);

        // Skill event: alice's slash pushes a seeded stone (STONE_PUSHED).
        support.insertStone(StoneColor.WHITE, 2, 3);
        support.ensureTurn("alice");
        support.placeAs("alice",
                "{\"row\":3,\"col\":3,\"skill\":{\"skillType\":\"HORIZONTAL_SLASH\",\"direction\":\"UP\"}}");
        assertLastSuccess();

        // Field event: bob steps on the hidden tide cell (TIDE_TRIGGERED).
        support.ensureTurn("bob");
        support.placeAs("bob", "{\"row\":10,\"col\":10}");
        assertLastSuccess();

        // Finish the game: black completes five-in-a-row.
        support.insertStone(StoneColor.BLACK, 7, 5);
        support.insertStone(StoneColor.BLACK, 7, 6);
        support.insertStone(StoneColor.BLACK, 7, 7);
        support.insertStone(StoneColor.BLACK, 7, 8);
        support.ensureTurn("alice");
        support.placeAs("alice", "{\"row\":7,\"col\":9}");
        assertLastSuccess();
        Assertions.assertThat(support.requireGame().getStatus().name()).isEqualTo("FINISHED");

        ctx.putMemo("serverGameId:" + specGameId, support.gameId());
    }

    @Then("回放資料包含技能事件（如 SkillUsed \\/ StonesPushed \\/ ColorsSwapped）")
    public void replayContainsSkillEvents() {
        Assertions.assertThat(replayEventTypes())
                .anyMatch(t -> t.equals("STONE_PUSHED") || t.equals("COLORS_SWAPPED")
                        || t.equals("STONE_REPLACED") || t.equals("STONES_CLEARED"));
    }

    @And("回放資料包含場地事件（如 WaveSurged \\/ TideTriggered \\/ SandEroded）")
    public void replayContainsFieldEvents() {
        Assertions.assertThat(replayEventTypes())
                .anyMatch(t -> t.equals("WAVE_SURGED") || t.equals("TIDE_TRIGGERED")
                        || t.equals("SAND_ERODED") || t.equals("VOLCANO_ERUPTED"));
    }

    @And("賽後回放可完整重現對局，隱藏格（漲潮\\/噴發）位置於回放中可被揭露")
    public void replayRevealsTriggeredHiddenCells() {
        List<Map<String, Object>> events = replayFieldEvents();
        boolean revealed = events.stream().anyMatch(e ->
                "TIDE_TRIGGERED".equals(e.get("eventType"))
                        && Integer.valueOf(10).equals(e.get("row"))
                        && Integer.valueOf(10).equals(e.get("col")));
        Assertions.assertThat(revealed)
                .as("replay must reveal the triggered hidden cell position").isTrue();
    }

    // ================================================================
    // helpers
    // ================================================================

    /** Deterministic beach: cleared cells, fixed sea side, counter at 9 (next hand waves). */
    private void prepareBeach(BoardSide seaSide, boolean tideTriggered, int erodedRows) {
        support.createSeriousGame("BEACH", "WARRIOR", "ARCHER");
        support.clearFieldCells();
        FieldState state = support.fieldState();
        state.setSeaSide(seaSide);
        state.setTideTriggered(tideTriggered);
        state.setErodedRows(erodedRows);
        state.setRoundCounter(9);
        support.saveFieldState(state);
    }

    /** One API hand by the current-turn player (far corner, away from fixtures). */
    private void playOneHand() {
        String user = support.currentTurnUser();
        Integer idx = (Integer) ctx.getMemo("handIdx");
        if (idx == null) {
            idx = 0;
        }
        ctx.putMemo("handIdx", idx + 1);
        support.placeAs(user, String.format("{\"row\":%d,\"col\":%d}", 14, (idx * 3) % 13));
        assertLastSuccess();
    }

    private void assertLastSuccess() {
        ResponseEntity<?> resp = ctx.getLastResponse();
        Assertions.assertThat(resp).isNotNull();
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("expected 2xx but got %s: %s", resp.getStatusCode(), resp.getBody())
                .isTrue();
    }

    /** GET game state for both seats and verify no untriggered hidden cell leaks. */
    private void assertHiddenCellsNotExposed() {
        long triggered = support.fieldCells().findByGameIdAndDeletedFalse(support.gameId()).stream()
                .filter(c -> c.getCellKind() != FieldCellKind.OBSTACLE && c.isTriggered())
                .count();
        for (String user : new String[]{"alice", "bob"}) {
            Map<?, ?> state = support.getAs(user, "/api/gmk/v1/games/" + support.gameId());
            List<?> revealed = (List<?>) state.get("revealedHiddenCells");
            Assertions.assertThat(revealed == null ? 0 : revealed.size())
                    .as("only triggered hidden cells may be exposed")
                    .isEqualTo((int) triggered);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> replayFieldEvents() {
        ResponseEntity<?> resp = ctx.getLastResponse();
        Map<?, ?> body = (Map<?, ?>) resp.getBody();
        Map<?, ?> data = (Map<?, ?>) body.get("data");
        Object events = data.get("fieldEvents");
        Assertions.assertThat(events).as("replay must include fieldEvents").isInstanceOf(List.class);
        return (List<Map<String, Object>>) events;
    }

    private List<String> replayEventTypes() {
        return replayFieldEvents().stream().map(e -> String.valueOf(e.get("eventType"))).toList();
    }

    private FieldEventDetail parseDetail(FieldEvent event) {
        try {
            return objectMapper.readValue(event.getDetail(), FieldEventDetail.class);
        } catch (Exception e) {
            throw new AssertionError("unparseable event detail: " + event.getDetail(), e);
        }
    }
}
