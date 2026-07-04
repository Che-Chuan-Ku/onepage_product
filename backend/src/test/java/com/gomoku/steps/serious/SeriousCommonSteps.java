package com.gomoku.steps.serious;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.FieldCell;
import com.gomoku.domain.entity.FieldState;
import com.gomoku.domain.entity.Game;
import com.gomoku.domain.entity.Move;
import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.FieldEventType;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.repository.FieldCellRepository;
import com.gomoku.repository.FieldEventRepository;
import com.gomoku.repository.FieldStateRepository;
import com.gomoku.repository.GameRepository;
import com.gomoku.repository.MoveRepository;
import com.gomoku.repository.SkillUsageRepository;
import com.gomoku.service.SeriousDuelService;
import com.gomoku.steps.common_given.CommonGiven;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Shared setup helpers + Background steps for all Serious Duel features.
 * Convention: alice = host = BLACK, bob = guest = WHITE (startOnlineGame
 * assigns host→BLACK). Field determinism: scenarios that pin exact cells call
 * {@link #clearFieldCells()} and insert fixtures via repositories.
 */
public class SeriousCommonSteps {

    @Autowired
    private TestRestTemplate restTemplate;
    @Autowired
    private ScenarioContext ctx;
    @Autowired
    private CommonGiven commonGiven;
    @Autowired
    private GameRepository gameRepository;
    @Autowired
    private MoveRepository moveRepository;
    @Autowired
    private FieldCellRepository fieldCellRepository;
    @Autowired
    private FieldStateRepository fieldStateRepository;
    @Autowired
    private FieldEventRepository fieldEventRepository;
    @Autowired
    private SkillUsageRepository skillUsageRepository;
    @Autowired
    private SeriousDuelService seriousDuelService;

    // ================================================================
    // Shared Backgrounds
    // ================================================================

    @Given("一場真劍勝負對局進行中")
    public void seriousDuelInProgress() {
        createSeriousGame("VOLCANO", "WARRIOR", "ARCHER");
        clearFieldCells(); // deterministic empty field for skill/economy scenarios
    }

    @And("玩家 {string}（劍士，黑）與 {string}（弓箭手，白）")
    public void playersWithClasses(String warrior, String archer) {
        // Classes/colors already fixed by createSeriousGame (alice=WARRIOR/BLACK,
        // bob=ARCHER/WHITE); assert the seeded game matches the spec wording.
        Game game = requireGame();
        Assertions.assertThat(game.getBlackClass()).hasToString("WARRIOR");
        Assertions.assertThat(game.getWhiteClass()).hasToString("ARCHER");
    }

    @Given("一場真劍勝負對局進行中，場地為 {string}")
    public void seriousDuelInProgressWithField(String fieldType) {
        createSeriousGame(fieldType, "WARRIOR", "ARCHER");
        clearFieldCells();
    }

    @Given("一場真劍勝負對局使用 {string} 場地，棋盤為 15×15")
    public void seriousDuelUsingFieldWithBoard15(String fieldType) {
        createSeriousGame(fieldType, "WARRIOR", "ARCHER");
        // keep generated field: generation scenarios assert on it
    }

    @Given("一場真劍勝負對局使用 {string} 場地")
    public void seriousDuelUsingField(String fieldType) {
        createSeriousGame(fieldType, "WARRIOR", "ARCHER");
    }

    @Given("一場真劍勝負對局進行中，玩家 {string} 職業為 {string}")
    public void seriousDuelWithPlayerClass(String player, String classType) {
        // alice is always the WARRIOR/BLACK seat and bob the ARCHER/WHITE seat;
        // both class features use matching names (alice=WARRIOR, bob=ARCHER).
        createSeriousGame("VOLCANO", "WARRIOR", "ARCHER");
        clearFieldCells();
        Game game = requireGame();
        if ("alice".equals(player)) {
            Assertions.assertThat(game.getBlackClass().name()).isEqualTo(classType);
        } else {
            Assertions.assertThat(game.getWhiteClass().name()).isEqualTo(classType);
        }
    }

    @Given("一場真劍勝負對局進行中，場地含隱藏格（噴發格或漲潮格）")
    public void seriousDuelWithHiddenCells() {
        createSeriousGame("VOLCANO", "WARRIOR", "ARCHER");
        // Generated volcano fields always carry hidden eruption cells; keep them.
        Assertions.assertThat(fieldCellRepository
                        .findByGameIdAndCellKindAndDeletedFalse(gameId(), FieldCellKind.ERUPTION))
                .isNotEmpty();
    }

    // ================================================================
    // Game setup helpers (public: used by the other serious step classes)
    // ================================================================

    /** Full online flow: create serious room → join → select classes → ready → start. */
    public void createSeriousGame(String fieldType, String aliceClass, String bobClass) {
        commonGiven.playerIsLoggedIn("alice");
        commonGiven.playerIsLoggedIn("bob");

        String body = String.format(
                "{\"visibility\":\"PUBLIC\",\"battleMode\":\"SERIOUS_DUEL\",\"fieldType\":\"%s\"}",
                fieldType);
        Map<?, ?> data = postAs("alice", "/api/gmk/v1/rooms", body);
        String roomId = (String) data.get("roomId");
        Assertions.assertThat(roomId).as("serious room must be created").isNotNull();
        ctx.putMemo("seriousRoomId", roomId);

        postAs("bob", "/api/gmk/v1/rooms/" + roomId + "/actions/join", null);
        if (aliceClass != null) {
            postAs("alice", "/api/gmk/v1/rooms/" + roomId + "/actions/select-class",
                    "{\"classType\":\"" + aliceClass + "\"}");
        }
        if (bobClass != null) {
            postAs("bob", "/api/gmk/v1/rooms/" + roomId + "/actions/select-class",
                    "{\"classType\":\"" + bobClass + "\"}");
        }
        postAs("alice", "/api/gmk/v1/rooms/" + roomId + "/actions/toggle-ready", null);
        postAs("bob", "/api/gmk/v1/rooms/" + roomId + "/actions/toggle-ready", null);

        Map<?, ?> started = postAs("alice", "/api/gmk/v1/rooms/" + roomId + "/actions/start-game", null);
        Assertions.assertThat(((ResponseEntity<?>) ctx.getLastResponse()).getStatusCode().value())
                .as("startGame must return 201 Created (GameDetailResponse, api.yml:423-437)")
                .isEqualTo(201);
        String gameId = (String) started.get("gameId");
        Assertions.assertThat(gameId).as("serious game must be started").isNotNull();
        Assertions.assertThat(started.get("gameMode")).as("GameDetailResponse.gameMode").isNotNull();
        Assertions.assertThat(started.get("currentTurn")).as("GameDetailResponse.currentTurn").isNotNull();
        ctx.putMemo("gameId", gameId);
        ctx.putMemo("seriousGameId", gameId);
    }

    public String gameId() {
        Object id = ctx.getMemo("seriousGameId");
        Assertions.assertThat(id).as("serious game must be set up first").isNotNull();
        return id.toString();
    }

    public Game requireGame() {
        return gameRepository.findById(gameId()).orElseThrow();
    }

    /** Remove every generated field cell (obstacles + hidden) for determinism. */
    public void clearFieldCells() {
        fieldCellRepository.deleteAll(fieldCellRepository.findByGameIdAndDeletedFalse(gameId()));
    }

    /** Insert a fixture field cell. */
    public void insertFieldCell(FieldCellKind kind, int row, int col, boolean visible) {
        fieldCellRepository.findByGameIdAndRowAndColAndDeletedFalse(gameId(), row, col)
                .ifPresent(fieldCellRepository::delete);
        FieldCell cell = new FieldCell();
        cell.setGameId(gameId());
        cell.setCellKind(kind);
        cell.setRow(row);
        cell.setCol(col);
        cell.setVisibleToPlayers(visible);
        fieldCellRepository.save(cell);
    }

    /** Directly insert a stone fixture (bypasses turn logic; keeps move numbering valid). */
    public void insertStone(StoneColor color, int row, int col) {
        Game game = requireGame();
        Move move = new Move();
        move.setGameId(game.getId());
        move.setMoveNumber(game.getMoveCount() + 1);
        move.setColor(color);
        move.setRow(row);
        move.setCol(col);
        moveRepository.save(move);
        game.setMoveCount(game.getMoveCount() + 1);
        gameRepository.save(game);
    }

    public FieldState fieldState() {
        return fieldStateRepository.findByGameIdAndDeletedFalse(gameId()).orElseThrow();
    }

    public void saveFieldState(FieldState state) {
        fieldStateRepository.save(state);
    }

    /** POST as a user; memoizes lastResponse; returns response "data" map (or null). */
    public Map<?, ?> postAs(String user, String path, String jsonBody) {
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                path, new HttpEntity<>(jsonBody, commonGiven.authHeaders(user)), Map.class);
        ctx.setLastResponse(resp);
        if (resp.getBody() != null && resp.getBody().get("data") instanceof Map<?, ?> data) {
            return data;
        }
        return null;
    }

    public Map<?, ?> getAs(String user, String path) {
        org.springframework.http.HttpEntity<Void> entity =
                new org.springframework.http.HttpEntity<>(commonGiven.authHeaders(user));
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> resp = restTemplate.exchange(
                path, org.springframework.http.HttpMethod.GET, entity, Map.class);
        ctx.setLastResponse(resp);
        if (resp.getBody() != null && resp.getBody().get("data") instanceof Map<?, ?> data) {
            return data;
        }
        return null;
    }

    /** Place a move via API as the given user (body = raw MoveCreateRequest JSON). */
    public void placeAs(String user, String jsonBody) {
        postAs(user, "/api/gmk/v1/games/" + gameId() + "/moves", jsonBody);
    }

    /** Whose color currently moves: "alice"=BLACK, "bob"=WHITE (host/guest fixed). */
    public String currentTurnUser() {
        Game game = requireGame();
        return game.getCurrentTurn() == StoneColor.WHITE ? "bob" : "alice";
    }

    /**
     * Make it {@code user}'s turn by letting the opponent place a spaced filler
     * stone near the board edge (spacing 3 prevents accidental 5-in-a-row).
     */
    public void ensureTurn(String user) {
        if (currentTurnUser().equals(user)) {
            return;
        }
        String opponent = user.equals("alice") ? "bob" : "alice";
        Integer fillerIdx = (Integer) ctx.getMemo("fillerIdx:" + opponent);
        if (fillerIdx == null) {
            fillerIdx = 0;
        }
        int size = requireGame().getFieldType() != null
                && requireGame().getFieldType().name().equals("BEACH") ? 16 : 15;
        int row = opponent.equals("alice") ? size - 2 : size - 1;
        int col = (fillerIdx * 3) % size;
        ctx.putMemo("fillerIdx:" + opponent, fillerIdx + 1);
        placeAs(opponent, String.format("{\"row\":%d,\"col\":%d}", row, col));
        Assertions.assertThat(((ResponseEntity<?>) ctx.getLastResponse()).getStatusCode().is2xxSuccessful())
                .as("filler move by %s must succeed", opponent)
                .isTrue();
    }

    /** All persisted field events of a type for the current game. */
    public List<com.gomoku.domain.entity.FieldEvent> eventsOfType(FieldEventType type) {
        List<com.gomoku.domain.entity.FieldEvent> result = new ArrayList<>();
        for (com.gomoku.domain.entity.FieldEvent e
                : fieldEventRepository.findByGameIdOrderByOccurredAtAscIdAsc(gameId())) {
            if (e.getEventType() == type) {
                result.add(e);
            }
        }
        return result;
    }

    public SkillUsageRepository skillUsages() {
        return skillUsageRepository;
    }

    /** Current stone color at (row,col), via authoritative board reconstruction. */
    public StoneColor stoneColorAt(int row, int col) {
        Game game = requireGame();
        int size = game.getFieldType() != null && game.getFieldType().name().equals("BEACH") ? 16 : 15;
        return seriousDuelService
                .rebuildBoard(game, size, fieldCellRepository.findByGameIdAndDeletedFalse(gameId()))
                .stoneAt(row, col);
    }

    /** Whether either seat used the given skill in the current game. */
    public boolean skillUsageRecorded(com.gomoku.domain.enums.SkillType type) {
        for (String user : new String[]{"alice", "bob"}) {
            Object playerId = ctx.getMemo("playerId:" + user);
            if (playerId != null && skillUsageRepository.existsByGameIdAndPlayerIdAndSkillType(
                    gameId(), playerId.toString(), type)) {
                return true;
            }
        }
        return false;
    }

    /** Whether any skill usage was recorded in the current game. */
    public boolean anySkillUsageRecorded() {
        for (String user : new String[]{"alice", "bob"}) {
            Object playerId = ctx.getMemo("playerId:" + user);
            if (playerId != null && !skillUsageRepository
                    .findByGameIdAndPlayerId(gameId(), playerId.toString()).isEmpty()) {
                return true;
            }
        }
        return false;
    }

    public FieldCellRepository fieldCells() {
        return fieldCellRepository;
    }

    public ScenarioContext ctx() {
        return ctx;
    }

    public CommonGiven common() {
        return commonGiven;
    }
}
