package com.gomoku.steps.pve;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveEncounterEvent;
import com.gomoku.domain.entity.PveEncounterMove;
import com.gomoku.domain.entity.PveFieldState;
import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.PveEncounterEventType;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.game.PveEventDetail;
import com.gomoku.game.SeriousBoard;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Steps for features/pve/魔王對弈.feature (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §1). */
public class BossDuelSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;
    @Autowired private ObjectMapper objectMapper;

    @Given("玩家位於第{int}關魔王對弈")
    public void playerAtDuelEncounter(int sequence) {
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getEncounterType().name()).isEqualTo("DUEL");
    }

    @Given("玩家位於第{int}關魔王對弈，手數預算設為 {int}")
    public void playerAtDuelEncounterWithBudget(int sequence, int budget) {
        support.jumpToEncounter(sequence);
        support.setMoveBudget(budget);
        // §6.5 DRAW-retry scenarios: snapshot Run-level economy before any
        // draw/retry cycle so a later step can assert it's untouched.
        ctx.putMemo("pve:goldBefore", support.run().getGold());
        ctx.putMemo("pve:reachedBefore", support.run().getReachedEncounterSequence());
    }

    @Given("^玩家位於第(\\d+)關魔王對弈，關卡狀態為 \"([A-Z_]+)\"$")
    public void playerAtDuelEncounterWithStatus(int sequence, String status) {
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getEncounterType().name()).isEqualTo("DUEL");
        Assertions.assertThat(support.encounter().getStatus().name()).isEqualTo(status);
    }

    @Given("^玩家位於第(\\d+)關（PUZZLE）$")
    public void playerAtPuzzleEncounter(int sequence) {
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getEncounterType().name()).isEqualTo("PUZZLE");
    }

    // ────────────────────────── seeding real stones directly (bypasses placeMove's boss reply) ──

    @Given("^玩家已有橫向四連 \\((\\d+),(\\d+)\\)-\\((\\d+),(\\d+)\\)$")
    public void playerHasHorizontalFourInARow(int r1, int c1, int r2, int c2) {
        Assertions.assertThat(r1).isEqualTo(r2);
        seedPlayerMoves(r1, Math.min(c1, c2), Math.max(c1, c2));
    }

    /** §3.3 ⑥前 精準狙擊 test setup: a genuine contiguous open three (both flanks left empty). */
    @Given("^玩家已有橫向三連（活三）\\((\\d+),(\\d+)\\)-\\((\\d+),(\\d+)\\)$")
    public void playerHasHorizontalOpenThree(int r1, int c1, int r2, int c2) {
        Assertions.assertThat(r1).isEqualTo(r2);
        seedPlayerMoves(r1, Math.min(c1, c2), Math.max(c1, c2));
    }

    private void seedPlayerMoves(int row, int colFrom, int colTo) {
        PveEncounter encounter = support.encounter();
        int n = encounter.getMovesUsed();
        for (int c = colFrom; c <= colTo; c++) {
            n++;
            PveEncounterMove move = new PveEncounterMove();
            move.setEncounterId(encounter.getId());
            move.setEncounterMoveNumber(n);
            move.setRunMoveNumber(n);
            move.setRow(row);
            move.setCol(c);
            support.moves().save(move);
        }
        encounter.setMovesUsed(n);
        support.encounters().save(encounter);
    }

    @Given("^Boss已有橫向四連 \\((\\d+),(\\d+)\\)-\\((\\d+),(\\d+)\\)，且已有過1手回手紀錄$")
    public void bossHasHorizontalFourInARow(int r1, int c1, int r2, int c2) {
        Assertions.assertThat(r1).isEqualTo(r2);
        // A prior BOSS_MOVE_PLACED event (far away, harmless) so the NEXT boss
        // reply takes the BossAiPolicy path (not the scripted opening move) —
        // pastEventCount(BOSS_MOVE_PLACED) must be > 0 (see settleDuel).
        seedBossMoveEvent(10, 10);
        for (int c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            seedBossMoveEvent(r1, c);
        }
    }

    @Given("^玩家位於第(\\d+)關魔王對弈，Boss於 \\((\\d+),(\\d+)\\) 已有一子$")
    public void bossHasOneStoneAt(int sequence, int row, int col) {
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getEncounterType().name()).isEqualTo("DUEL");
        seedBossMoveEvent(row, col);
    }

    /**
     * L8 SKILL_DEMON only (documents/PVE-全對弈階梯設計-2026-07-10.md §3.3
     * MIN_SKILL_TRIGGER_TURN 校準): PRECISION_SNIPE/SCATTER_SHOT only become
     * available from the boss's 10th reply onward — seed 9 prior, scattered
     * (never 3-in-a-row), harmless boss moves so the NEXT real boss turn is
     * ordinal 10 and the skill can actually fire.
     */
    @Given("^玩家位於第(\\d+)關魔王對弈，Boss已有9手散落無關紀錄$")
    public void bossHasNineScatteredMoves(int sequence) {
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getEncounterType().name()).isEqualTo("DUEL");
        int[][] scattered = {{0, 0}, {0, 3}, {10, 0}, {10, 3}, {0, 10}, {10, 10}, {3, 0}, {0, 9}, {9, 10}};
        for (int[] rc : scattered) {
            seedBossMoveEvent(rc[0], rc[1]);
        }
    }

    @Given("^玩家位於第(\\d+)關魔王對弈，Boss於 \\((\\d+),(\\d+)\\)\\((\\d+),(\\d+)\\)\\((\\d+),(\\d+)\\) 已有連續三子$")
    public void bossHasThreeStonesInARow(int sequence, int r1, int c1, int r2, int c2, int r3, int c3) {
        support.jumpToEncounter(sequence);
        seedBossMoveEvent(r1, c1);
        seedBossMoveEvent(r2, c2);
        seedBossMoveEvent(r3, c3);
    }

    @Given("^玩家位於第(\\d+)關魔王對弈，Boss於 \\((\\d+),(\\d+)\\)\\((\\d+),(\\d+)\\) 已有兩子$")
    public void bossHasTwoStones(int sequence, int r1, int c1, int r2, int c2) {
        support.jumpToEncounter(sequence);
        seedBossMoveEvent(r1, c1);
        seedBossMoveEvent(r2, c2);
    }

    // ────────────────────────── L6 邊緣推浪 (§7.6 第二批 polish item #5) ────────

    /**
     * Pins the L6 BEACH encounter's wave state deterministically (the sea
     * side is otherwise seed-random): sea on NORTH (ocean rows 0-4, push
     * direction DOWN/sandward) and the wave counter primed so the player's
     * NEXT placement is the {@code WAVE_HANDS}th hand that fires the push.
     */
    @Given("^玩家位於第6關魔王對弈，海側為北且推浪計數器為 (\\d+)$")
    public void playerAtBeachDuelWithWaveCounter(int counter) {
        support.jumpToEncounter(6);
        Assertions.assertThat(support.encounter().getFieldType().name()).isEqualTo("BEACH");
        PveFieldState state = support.fieldStates()
                .findByEncounterIdAndDeletedFalse(support.encounterId()).orElseThrow();
        state.setSeaSide(BoardSide.NORTH);
        state.setWaveMoveCounter(counter);
        support.fieldStates().save(state);
    }

    /** A contiguous alternating (player-black first) stone chain down column {@code col}, rows {@code rowFrom..rowTo}. */
    @Given("^第 (\\d+) 直行的列 (\\d+) 至列 (\\d+) 佈有黑白相間棋子鏈（起自玩家黑子）$")
    public void columnHasAlternatingChain(int col, int rowFrom, int rowTo) {
        for (int r = rowFrom; r <= rowTo; r++) {
            if ((r - rowFrom) % 2 == 0) {
                seedPlayerMoveAt(r, col);
            } else {
                seedBossMoveEvent(r, col);
            }
        }
    }

    private void seedPlayerMoveAt(int row, int col) {
        PveEncounter encounter = support.encounter();
        int n = encounter.getMovesUsed() + 1;
        PveEncounterMove move = new PveEncounterMove();
        move.setEncounterId(encounter.getId());
        move.setEncounterMoveNumber(n);
        move.setRunMoveNumber(n);
        move.setRow(row);
        move.setCol(col);
        support.moves().save(move);
        encounter.setMovesUsed(n);
        support.encounters().save(encounter);
    }

    // Step name deliberately distinct from SeriousSkillSteps' own
    // "系統發布 StonesPushed 事件" (duplicate-step-definition clash).
    @Then("系統發布本關推浪 StonesPushed 事件")
    public void stonesPushedPublished() {
        Assertions.assertThat(support.events()
                        .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                                support.encounterId(), PveEncounterEventType.STONES_PUSHED))
                .isNotEmpty();
    }

    @Then("^系統發布 StoneRemovedOffBoard 事件於 \\((\\d+),(\\d+)\\)$")
    public void stoneRemovedOffBoardPublishedAt(int row, int col) {
        List<PveEncounterEvent> events = support.events()
                .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                        support.encounterId(), PveEncounterEventType.STONE_REMOVED_OFF_BOARD);
        boolean matched = events.stream()
                .anyMatch(e -> e.getRow() != null && e.getRow() == row && e.getCol() != null && e.getCol() == col);
        Assertions.assertThat(matched)
                .as("a STONE_REMOVED_OFF_BOARD event at (%d,%d) must exist, got %s", row, col,
                        events.stream().map(e -> "(" + e.getRow() + "," + e.getCol() + ")").toList())
                .isTrue();
    }

    @Then("本次推浪未發布 StoneRemovedOffBoard 事件")
    public void noStoneRemovedOffBoardPublished() {
        Assertions.assertThat(support.events()
                        .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                                support.encounterId(), PveEncounterEventType.STONE_REMOVED_OFF_BOARD))
                .isEmpty();
    }

    @Then("^重建盤面後 \\((\\d+),(\\d+)\\) 為玩家黑子$")
    public void rebuiltBoardHasBlackStoneAt(int row, int col) {
        Assertions.assertThat(support.currentBoard().stoneAt(row, col)).isEqualTo(StoneColor.BLACK);
    }

    @Then("^重建盤面後 \\((\\d+),(\\d+)\\) 為Boss白子$")
    public void rebuiltBoardHasWhiteStoneAt(int row, int col) {
        Assertions.assertThat(support.currentBoard().stoneAt(row, col)).isEqualTo(StoneColor.WHITE);
    }

    /** Board-legality catch-all: replaying moves+events yields exactly N in-bounds, non-overlapping stones. */
    @Then("^重建盤面後棋子總數為 (\\d+)$")
    public void rebuiltBoardHasExactlyNStones(int expected) {
        SeriousBoard board = support.currentBoard();
        int count = 0;
        for (int r = 0; r < board.size(); r++) {
            for (int c = 0; c < board.size(); c++) {
                if (board.hasStone(r, c)) {
                    count++;
                }
            }
        }
        Assertions.assertThat(count).as("total stones on the rebuilt board").isEqualTo(expected);
    }

    private void seedBossMoveEvent(int row, int col) {
        PveEncounter encounter = support.encounter();
        PveEncounterEvent event = new PveEncounterEvent();
        event.setEncounterId(encounter.getId());
        event.setMoveNumber(encounter.getMovesUsed());
        event.setEventType(PveEncounterEventType.BOSS_MOVE_PLACED);
        event.setRow(row);
        event.setCol(col);
        event.setOccurredAt(Instant.now());
        support.events().save(event);
    }

    // ────────────────────────── placement ──────────────────────────────────

    @When("^玩家落子於 \\((\\d+),(\\d+)\\) 完成連五$")
    public void playerPlacesWinningMove(int row, int col) {
        ResponseEntity<Map> resp = support.placeMoveApi(support.user(), row, col);
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("winning move (%d,%d) must succeed: %s", row, col, resp.getBody()).isTrue();
    }

    @When("^玩家於無關位置落子 \\((\\d+),(\\d+)\\)$")
    public void playerPlacesUnrelatedMove(int row, int col) {
        ResponseEntity<Map> resp = support.placeMoveApi(support.user(), row, col);
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("move (%d,%d) must succeed: %s", row, col, resp.getBody()).isTrue();
    }

    @When("^玩家於 \\((\\d+),(\\d+)\\) 落子且未連五$")
    public void playerPlacesNonWinningMove(int row, int col) {
        support.placeMoveApi(support.user(), row, col);
    }

    @Given("^玩家於 \\((\\d+),(\\d+)\\) 落子且未連五，關卡狀態為 \"([A-Z_]+)\"$")
    public void playerPlacesNonWinningMoveWithStatus(int row, int col, String expectedStatus) {
        ResponseEntity<Map> resp = support.placeMoveApi(support.user(), row, col);
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("non-winning move (%d,%d) must still succeed: %s", row, col, resp.getBody()).isTrue();
        Assertions.assertThat(support.encounter().getStatus().name()).isEqualTo(expectedStatus);
    }

    // ────────────────────────── retry (§1.5/§6.5 公平性修正) ──────────────────

    @When("玩家對該關卡呼叫重試")
    public void playerRetriesEncounter() {
        ctx.putMemo("pve:oldEncounterId", support.encounterId());
        support.retryEncounterApi(support.user());
    }

    @When("^玩家連續 (\\d+) 次「落子且未連五\\(DRAW\\)後立即重試」$")
    public void playerDrawsAndRetriesNTimes(int times) {
        for (int i = 0; i < times; i++) {
            // A brand-new retried encounter is created through the real
            // scheduler (createEncounter -> plan()), which reverts moveBudget
            // to the design-curve value (e.g. 45 for L4) — re-apply the
            // scenario's 1-move budget every iteration so each attempt
            // deterministically DRAWs on its very first (non-winning) move.
            support.setMoveBudget(1);
            ResponseEntity<Map> resp = support.placeMoveApi(support.user(), 5, 5);
            Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                    .as("attempt %d move must succeed: %s", i + 1, resp.getBody()).isTrue();
            Assertions.assertThat(support.encounter().getStatus().name())
                    .as("attempt %d must DRAW", i + 1).isEqualTo("DRAW");
            ResponseEntity<Map> retryResp = support.retryEncounterApi(support.user());
            Assertions.assertThat(retryResp.getStatusCode().is2xxSuccessful())
                    .as("attempt %d retry must succeed: %s", i + 1, retryResp.getBody()).isTrue();
        }
    }

    @When("^玩家第一手落子於 \\((\\d+),(\\d+)\\)$")
    public void playerPlacesFirstMove(int row, int col) {
        ResponseEntity<Map> resp = support.placeMoveApi(support.user(), row, col);
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("first move (%d,%d) must succeed: %s", row, col, resp.getBody()).isTrue();
    }

    // ────────────────────────── outcome assertions ───────────────────────────

    @Then("關卡狀態為 {string}")
    public void encounterStatusIs(String expected) {
        Assertions.assertThat(support.encounter().getStatus().name()).isEqualTo(expected);
    }

    // "系統發布 EncounterCleared 事件" step already defined in PveBattleSteps — reused as-is.

    @Then("本次結算傷害為 0（DUEL無傷害概念）")
    public void resolutionDamageIsZero() {
        Map<String, Object> resolution = support.lastResolution();
        Assertions.assertThat(resolution).isNotNull();
        Assertions.assertThat(((Number) resolution.get("damageDealt")).intValue()).isEqualTo(0);
    }

    @Then("Run狀態仍為 {string}")
    public void runStatusRemains(String expected) {
        Assertions.assertThat(support.run().getStatus().name()).isEqualTo(expected);
    }

    @Then("系統發布 EncounterDrawn 事件")
    public void encounterDrawnPublished() {
        Assertions.assertThat(support.events()
                        .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                                support.encounterId(), PveEncounterEventType.ENCOUNTER_DRAWN))
                .isNotEmpty();
    }

    @Then("^系統回傳一個新的第(\\d+)關魔王對弈關卡，狀態為 \"([A-Z_]+)\"、手數已用為 (\\d+)$")
    public void systemReturnsFreshDuelEncounter(int sequence, String status, int movesUsed) {
        Assertions.assertThat(support.lastResponse().getStatusCode().is2xxSuccessful())
                .as("retry response: %s", support.lastResponse()).isTrue();
        PveEncounter fresh = support.encounter();
        Assertions.assertThat(fresh.getEncounterType().name()).isEqualTo("DUEL");
        Assertions.assertThat(fresh.getSequence()).isEqualTo(sequence);
        Assertions.assertThat(fresh.getStatus().name()).isEqualTo(status);
        Assertions.assertThat(fresh.getMovesUsed()).isEqualTo(movesUsed);
    }

    @Then("原關卡不再可查詢（已標記刪除）")
    public void oldEncounterNoLongerQueryable() {
        String oldId = String.valueOf(ctx.getMemo("pve:oldEncounterId"));
        ResponseEntity<Map> resp = support.getEncounterByIdApi(support.user(), oldId);
        Assertions.assertThat(resp.getStatusCode().value()).isEqualTo(404);
    }

    @Then("Run金幣與已抵達關卡序號皆與流程開始前相同")
    public void runGoldAndReachUnchanged() {
        int goldBefore = (int) ctx.getMemo("pve:goldBefore");
        int reachedBefore = (int) ctx.getMemo("pve:reachedBefore");
        Assertions.assertThat(support.run().getGold()).as("gold must be untouched by DRAW/retry").isEqualTo(goldBefore);
        Assertions.assertThat(support.run().getReachedEncounterSequence())
                .as("reachedEncounterSequence must be untouched by DRAW/retry").isEqualTo(reachedBefore);
    }

    @Then("系統回傳422錯誤")
    public void systemReturns422() {
        Assertions.assertThat(support.lastResponse().getStatusCode().value()).isEqualTo(422);
    }

    @Then("^系統發布 EncounterFailed 事件，原因為 \"([A-Z_]+)\"$")
    public void encounterFailedPublishedWithReason(String reason) throws Exception {
        List<PveEncounterEvent> events = support.events()
                .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                        support.encounterId(), PveEncounterEventType.ENCOUNTER_FAILED);
        Assertions.assertThat(events).isNotEmpty();
        PveEncounterEvent event = events.get(events.size() - 1);
        Assertions.assertThat(event.getDetail()).as("ENCOUNTER_FAILED detail must carry a reason").isNotNull();
        PveEventDetail detail = objectMapper.readValue(event.getDetail(), PveEventDetail.class);
        Assertions.assertThat(detail.reason()).isEqualTo(reason);
    }

    @Then("^Boss第一手回應座標為 \\((\\d+),(\\d+)\\)$")
    public void bossFirstMoveRespondsAt(int row, int col) {
        List<PveEncounterEvent> events = support.events()
                .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                        support.encounterId(), PveEncounterEventType.BOSS_MOVE_PLACED);
        Assertions.assertThat(events).hasSizeGreaterThanOrEqualTo(1);
        PveEncounterEvent first = events.get(0);
        Assertions.assertThat(new int[]{first.getRow(), first.getCol()}).isEqualTo(new int[]{row, col});
    }

    @Then("^obstacles中恰有1個座標且kind為 \"([A-Z_]+)\"$")
    @SuppressWarnings("unchecked")
    public void obstaclesContainExactlyOneWithKind(String kind) {
        Map<String, Object> state = support.getEncounterApi(support.user());
        List<Map<String, Object>> obstacles = (List<Map<String, Object>>) state.get("obstacles");
        Assertions.assertThat(obstacles).hasSize(1);
        Assertions.assertThat(obstacles.get(0).get("kind")).isEqualTo(kind);
    }

    /** §4.2 L5 火山: 一次性靜態岩石數量落在設計範圍內 (5-8, all kind=ROCK). */
    @Then("^該關障礙格（kind為ROCK）數量介於(\\d+)至(\\d+)之間$")
    @SuppressWarnings("unchecked")
    public void rockObstacleCountBetween(int min, int max) {
        Map<String, Object> state = support.getEncounterApi(support.user());
        List<Map<String, Object>> obstacles = (List<Map<String, Object>>) state.get("obstacles");
        long rocks = obstacles.stream().filter(o -> "ROCK".equals(o.get("kind"))).count();
        Assertions.assertThat(rocks).isBetween((long) min, (long) max);
    }

    /** L6 海浪: encounter's fieldType is BEACH (so the shared WAVE_HANDS push cadence applies). */
    @Then("該關場地類型為 {string}")
    public void encounterFieldTypeIs(String expected) {
        Assertions.assertThat(support.encounter().getFieldType().name()).isEqualTo(expected);
    }

    // ────────────────────────── L8 SKILL_DEMON boss-cast skills ──────────────

    @Then("^Boss使用精準狙擊將 \\((\\d+),(\\d+)\\) 轉為Boss棋子$")
    @SuppressWarnings("unchecked")
    public void bossSnipedCellIntoEnemyStone(int row, int col) {
        List<PveEncounterEvent> events = support.events().findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                support.encounterId(), PveEncounterEventType.SKILL_USED);
        boolean bossSniped = events.stream().anyMatch(e -> isBossSkillEvent(e, "PRECISION_SNIPE"));
        Assertions.assertThat(bossSniped).as("a caster=BOSS PRECISION_SNIPE SKILL_USED event must exist").isTrue();
        Map<String, Object> state = support.getEncounterApi(support.user());
        List<Map<String, Object>> obstacles = (List<Map<String, Object>>) state.get("obstacles");
        boolean sniped = obstacles.stream().anyMatch(o ->
                ((Number) o.get("row")).intValue() == row && ((Number) o.get("col")).intValue() == col
                        && "ENEMY_STONE".equals(o.get("kind")));
        Assertions.assertThat(sniped).as("(%d,%d) must now be a boss (ENEMY_STONE) cell", row, col).isTrue();
    }

    @Then("^Boss使用開拓之星清空玩家的活四，其中 \\((\\d+),(\\d+)\\) 與 \\((\\d+),(\\d+)\\) 不再有棋子$")
    public void bossPioneerStarClearsPlayerFour(int r1, int c1, int r2, int c2) {
        List<PveEncounterEvent> events = support.events().findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                support.encounterId(), PveEncounterEventType.SKILL_USED);
        boolean bossPioneered = events.stream().anyMatch(e -> isBossSkillEvent(e, "PIONEER_STAR"));
        Assertions.assertThat(bossPioneered).as("a caster=BOSS PIONEER_STAR SKILL_USED event must exist").isTrue();
        Set<Long> stones = support.stoneKeys(support.getEncounterApi(support.user()));
        Assertions.assertThat(stones).doesNotContain(PveCommonSteps.key(r1, c1), PveCommonSteps.key(r2, c2));
    }

    /**
     * bug fix verification (game-balance task item #2, 2026-07-10): a
     * caster="BOSS" skill cast is persisted at the SAME moveNumber as the
     * player's just-completed move (settleMoveNumber is shared across the
     * whole settlement batch) — the old per-interval lock
     * ({@code eventRepository.existsByEncounterIdAndEventTypeAndMoveNumber})
     * counted ANY SKILL_USED event regardless of caster, so a boss cast this
     * interval wrongly locked the player out of their own skill for that same
     * interval. Fixed via {@code playerSkillUsedThisInterval}'s caster filter.
     */
    @Then("玩家仍可於本間隔使用自己的技能")
    public void playerCanStillUseOwnSkillThisInterval() {
        support.grantSkill(SkillType.SCATTER_SHOT, 1);
        ResponseEntity<Map> resp = support.useSkillApi(support.user(),
                "{\"skillType\":\"SCATTER_SHOT\",\"anchor\":{\"row\":1,\"col\":1},\"secondStone\":{\"row\":9,\"col\":9}}");
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("player's own skill must succeed in the same interval as a boss cast: %s", resp.getBody())
                .isTrue();
    }

    private boolean isBossSkillEvent(PveEncounterEvent event, String skillType) {
        if (event.getDetail() == null) {
            return false;
        }
        try {
            PveEventDetail detail = objectMapper.readValue(event.getDetail(), PveEventDetail.class);
            return skillType.equals(detail.skillType()) && "BOSS".equals(detail.caster());
        } catch (Exception e) {
            return false;
        }
    }

    // ────────────────────────── skills (§1.6 智取路徑) ────────────────────────

    @When("^玩家使用精準狙擊策反 \\((\\d+),(\\d+)\\)$")
    public void playerSnipesBossStone(int row, int col) {
        rememberBossMoveEventCount();
        support.grantSkill(SkillType.PRECISION_SNIPE, 1);
        ResponseEntity<Map> resp = support.useSkillApi(support.user(),
                String.format("{\"skillType\":\"PRECISION_SNIPE\",\"target\":{\"row\":%d,\"col\":%d}}", row, col));
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("precision snipe must succeed: %s", resp.getBody()).isTrue();
    }

    @Then("^\\((\\d+),(\\d+)\\) 變為玩家棋子$")
    public void cellBecomesPlayerStone(int row, int col) {
        Set<Long> stones = support.stoneKeys(support.lastState());
        Assertions.assertThat(stones).contains(PveCommonSteps.key(row, col));
    }

    @When("玩家使用橫劈技能推擠涵蓋這排Boss棋子")
    public void playerSlashesBossRow() {
        rememberBossMoveEventCount();
        support.grantSkill(SkillType.HORIZONTAL_SLASH, 1);
        // Anchor one row above the boss's 3-in-a-row, pushing it DOWN
        // (PveChallengeService#slashPush: sources = anchorRow+dir.dRow(), cols
        // anchorCol-1..anchorCol+1) — matches (5,4)/(5,5)/(5,6) exactly.
        ResponseEntity<Map> resp = support.useSkillApi(support.user(),
                "{\"skillType\":\"HORIZONTAL_SLASH\",\"direction\":\"DOWN\",\"anchor\":{\"row\":4,\"col\":5}}");
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("horizontal slash must succeed: %s", resp.getBody()).isTrue();
    }

    @Then("Boss於該排的棋子依推擠解算器規則被推移")
    public void bossRowPushed() {
        Set<Long> obstacles = support.obstacleKeys(support.lastState());
        // Pushed DOWN by 1 row: originals (5,4)(5,5)(5,6) must be gone, new
        // positions (6,4)(6,5)(6,6) must hold the pushed stones.
        Assertions.assertThat(obstacles)
                .doesNotContain(PveCommonSteps.key(5, 4), PveCommonSteps.key(5, 5), PveCommonSteps.key(5, 6))
                .contains(PveCommonSteps.key(6, 4), PveCommonSteps.key(6, 5), PveCommonSteps.key(6, 6));
    }

    @When("玩家使用開拓之星清除該範圍")
    public void playerUsesPioneerStar() {
        rememberBossMoveEventCount();
        support.grantSkill(SkillType.PIONEER_STAR, 1);
        // Anchor (4,3) — empty, adjacent to both target boss stones — with
        // direction DOWN covers the 2x3 zone {(4,2..4),(5,2..4)} which
        // includes (4,4) and (5,4) (FieldGeometry#ultimateZone).
        ResponseEntity<Map> resp = support.useSkillApi(support.user(),
                "{\"skillType\":\"PIONEER_STAR\",\"direction\":\"DOWN\",\"anchor\":{\"row\":4,\"col\":3}}");
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("pioneer star must succeed: %s", resp.getBody()).isTrue();
    }

    @Then("^\\((\\d+),(\\d+)\\) 與 \\((\\d+),(\\d+)\\) 皆不再有棋子$")
    public void bothCellsNoLongerHaveStones(int r1, int c1, int r2, int c2) {
        Set<Long> stones = support.stoneKeys(support.lastState());
        Set<Long> obstacles = support.obstacleKeys(support.lastState());
        Assertions.assertThat(stones).doesNotContain(PveCommonSteps.key(r1, c1), PveCommonSteps.key(r2, c2));
        Assertions.assertThat(obstacles).doesNotContain(PveCommonSteps.key(r1, c1), PveCommonSteps.key(r2, c2));
    }

    private void rememberBossMoveEventCount() {
        ctx.putMemo("pve:bossMoveEventsBefore", bossMoveEventCount());
    }

    @Then("本次操作不觸發Boss回手（BossMovePlaced事件數不變）")
    public void skillDoesNotTriggerBossReply() {
        int before = (int) ctx.getMemo("pve:bossMoveEventsBefore");
        Assertions.assertThat(bossMoveEventCount()).isEqualTo(before);
    }

    private int bossMoveEventCount() {
        return support.events().findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                support.encounterId(), PveEncounterEventType.BOSS_MOVE_PLACED).size();
    }
}
