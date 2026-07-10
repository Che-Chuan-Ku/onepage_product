package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveEncounterEvent;
import com.gomoku.domain.entity.PveFieldCell;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.PveEncounterEventType;
import com.gomoku.domain.enums.PveEncounterStatus;
import com.gomoku.domain.enums.SkillType;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Steps for features/pve/連線傷害結算.feature, 關卡勝敗判定.feature and
 * 技能使用.feature (FR-B2/B3/B4/B5, FR-A2).
 */
public class PveBattleSteps {

    private static final Pattern CELL = Pattern.compile("\\((\\d+),(\\d+)\\)");

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;

    private static List<int[]> parseCells(String text) {
        List<int[]> cells = new ArrayList<>();
        Matcher m = CELL.matcher(text);
        while (m.find()) {
            cells.add(new int[]{Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2))});
        }
        return cells;
    }

    private void placeAll(List<int[]> cells) {
        for (int[] cell : cells) {
            ResponseEntity<Map> resp = support.placeMoveApi(support.user(), cell[0], cell[1]);
            Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                    .as("setup move (%d,%d) must succeed: %s", cell[0], cell[1], resp.getBody())
                    .isTrue();
        }
    }

    // ────────────────────────── 連線傷害結算 ──────────────────────────────────

    @Given("^玩家棋子於 (.+) 已連續相鄰$")
    public void stonesPrePlaced(String cellsText) {
        placeAll(parseCells(cellsText));
    }

    @Given("^玩家棋子於 (.+) 已連續相鄰，(.+) 亦已連續相鄰$")
    public void twoSegmentsPrePlaced(String first, String second) {
        placeAll(parseCells(first));
        placeAll(parseCells(second));
    }

    @When("^玩家於 \\((\\d+),(\\d+)\\) 落子形成橫向五連$")
    public void placeFormingHorizontalFive(int row, int col) {
        support.placeMoveApi(support.user(), row, col);
    }

    @When("^玩家於 \\((\\d+),(\\d+)\\) 落子同時連接兩個片段形成七連$")
    public void placeConnectingSegmentsToSeven(int row, int col) {
        support.placeMoveApi(support.user(), row, col);
    }

    // NOTE: the bare "玩家於 (r,c) 落子" step is shared with the PVP beach
    // feature and lives in SeriousFieldSteps, which branches to placePveAt()
    // when a PVE encounter is in scope.

    /** Bare placement used by the shared "玩家於 (r,c) 落子" step. */
    public void placePveAt(int row, int col) {
        support.placeMoveApi(support.user(), row, col);
    }

    @Then("^(.+) 這(\\d+)格棋子從棋盤移除，恢復可落子$")
    public void cellsRemovedAndPlayable(String cellsText, int count) {
        List<int[]> cells = parseCells(cellsText);
        Assertions.assertThat(cells).hasSize(count);
        Set<Long> stones = support.stoneKeys(support.lastState());
        for (int[] cell : cells) {
            Assertions.assertThat(stones)
                    .as("(%d,%d) must be removed from the board", cell[0], cell[1])
                    .doesNotContain(PveCommonSteps.key(cell[0], cell[1]));
        }
    }

    @Then("該七連全部7格棋子從棋盤移除")
    public void sevenLineFullyRemoved() {
        Assertions.assertThat(support.stoneKeys(support.lastState())).isEmpty();
    }

    @Given("^玩家棋子已鋪局，使得於 \\((\\d+),(\\d+)\\) 落子會同時完成橫向與縱向兩條五連$")
    public void crossSetup(int row, int col) {
        List<int[]> cells = new ArrayList<>();
        for (int c = col - 4; c < col; c++) {
            cells.add(new int[]{row, c});
        }
        for (int r = row - 4; r < row; r++) {
            cells.add(new int[]{r, col});
        }
        placeAll(cells);
        ctx.putMemo("pve:crossCell", new int[]{row, col});
    }

    @Then("系統各自結算橫向與縱向兩條線的傷害，各50，合計100")
    public void bothLinesSettledFiftyEach() {
        List<Map<String, Object>> lines = support.resolvedLines();
        Assertions.assertThat(lines).hasSize(2);
        Map<String, Object> resolution = support.lastResolution();
        Assertions.assertThat(((Number) resolution.get("damageDealt")).intValue()).isEqualTo(100);
    }

    @Then("^\\((\\d+),(\\d+)\\) 這顆共用棋子僅被移除一次$")
    public void sharedStoneRemovedOnce(int row, int col) {
        Assertions.assertThat(support.stoneKeys(support.lastState()))
                .doesNotContain(PveCommonSteps.key(row, col));
        // 4 + 4 setup stones + shared stone = 9 removed in total: board empty.
        Assertions.assertThat(support.stoneKeys(support.lastState())).isEmpty();
    }

    @Then("系統針對每條線各發布一次 LineResolved 事件")
    public void oneLineResolvedEventPerLine() {
        int moveNumber = support.encounter().getMovesUsed();
        long count = support.events()
                .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                        support.encounterId(), PveEncounterEventType.LINE_RESOLVED)
                .stream()
                .filter(e -> e.getMoveNumber() != null && e.getMoveNumber() == moveNumber)
                .count();
        Assertions.assertThat(count).isEqualTo(2);
    }

    @Given("玩家棋子鋪局使得落子後形成六連")
    public void sixLineSetup() {
        // cols shifted off col4 (default level-1 background pre-places a
        // TYPE_A shape at col4 — documents/PVE-關卡重設計-2026-07-08.md).
        placeAll(List.of(new int[]{5, 5}, new int[]{5, 6}, new int[]{5, 7},
                new int[]{5, 8}, new int[]{5, 10}));
        ctx.putMemo("pve:sixCell", new int[]{5, 9});
    }

    @When("玩家落子完成該六連")
    public void placeCompletingSix() {
        int[] cell = (int[]) ctx.getMemo("pve:sixCell");
        support.placeMoveApi(support.user(), cell[0], cell[1]);
    }

    // Negative placement scenarios (placePveMove 422, api.yml) — occupied cell,
    // out-of-bounds and obstacle cell are all rejected before settlement.

    @Given("^\\((\\d+),(\\d+)\\) 已有玩家棋子$")
    public void cellAlreadyHasPlayerStone(int row, int col) {
        ResponseEntity<Map> resp = support.placeMoveApi(support.user(), row, col);
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("setup stone (%d,%d) must succeed: %s", row, col, resp.getBody())
                .isTrue();
    }

    @Given("^\\((\\d+),(\\d+)\\) 為障礙格$")
    public void cellIsObstacleField(int row, int col) {
        PveFieldCell cell = new PveFieldCell();
        cell.setEncounterId(support.encounterId());
        cell.setCellKind(FieldCellKind.OBSTACLE);
        cell.setRow(row);
        cell.setCol(col);
        cell.setVisibleToPlayer(true);
        support.fieldCells().save(cell);
    }

    // ────────────────────────── 關卡勝敗判定 ──────────────────────────────────

    @Given("當前BossHP為{int}")
    public void currentBossHp(int hp) {
        support.setBossHp(hp);
    }

    @When("玩家落子結算造成傷害{int}")
    public void placeCausingDamage(int damage) {
        Assertions.assertThat(damage).as("test helper plays a plain 5-line (=50)").isEqualTo(50);
        support.playCleanVerticalLine(support.user());
    }

    @Then("BossHP降為{int}")
    public void bossHpDropsTo(int hp) {
        Assertions.assertThat(support.encounter().getBossHpCurrent()).isEqualTo(hp);
    }

    @Then("系統判定關卡通過")
    public void encounterJudgedCleared() {
        Assertions.assertThat(support.encounter().getStatus()).isEqualTo(PveEncounterStatus.CLEARED);
    }

    @Then("系統發布 EncounterCleared 事件")
    public void encounterClearedPublished() {
        Assertions.assertThat(support.events()
                        .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                                support.encounterId(), PveEncounterEventType.ENCOUNTER_CLEARED))
                .isNotEmpty();
    }

    @Then("系統不再接受本關後續落子")
    public void noFurtherMovesAccepted() {
        ResponseEntity<Map> resp = support.placeMoveApi(support.user(), 0, 0);
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful()).isFalse();
    }

    @Given("玩家已用滿30手，當前BossHP為{int}")
    public void movesNearlyExhaustedWithHp(int hp) {
        // Generic 30-move budget scenario (Background text), decoupled from the
        // real per-level MOVE_BUDGET_CURVE (level 1 is now 3) so this exercises
        // the moves-exhausted judgement rule in isolation (documents/PVE-關卡
        // 重設計-2026-07-08.md §1 changed the curve; this scenario's numbers are
        // illustrative, not level-1-specific).
        PveEncounter encounter = support.encounter();
        encounter.setMoveBudget(30);
        encounter.setMovesUsed(29);
        encounter.setBossHpCurrent(hp);
        support.encounters().save(encounter);
    }

    @When("第30手落子結算完成")
    public void thirtiethMoveSettles() {
        support.placeFillers(support.user(), 1);
    }

    @Then("系統判定關卡失敗")
    public void encounterJudgedFailed() {
        Assertions.assertThat(support.encounter().getStatus()).isEqualTo(PveEncounterStatus.FAILED);
    }

    @Then("系統發布 EncounterFailed 事件")
    public void encounterFailedPublished() {
        Assertions.assertThat(support.events()
                        .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                                support.encounterId(), PveEncounterEventType.ENCOUNTER_FAILED))
                .isNotEmpty();
    }

    @Given("該關已判定通過（EncounterCleared）")
    public void encounterAlreadyCleared() {
        PveEncounter encounter = support.encounter();
        encounter.setStatus(PveEncounterStatus.CLEARED);
        encounter.setClearedAt(Instant.now());
        support.encounters().save(encounter);
    }

    @When("玩家嘗試再次落子")
    public void playerAttemptsAnotherMove() {
        support.placeMoveApi(support.user(), 0, 0);
    }

    // Settlement display (FR-B7): win/loss, total damage (bossHpMax-bossHpCurrent),
    // remaining moves (moveBudget-movesUsed) and used-skill list, all queried
    // via the plain encounter GET (no new response fields — derived client-side).

    @Given("^第(\\d+)關通過，bossHpMax為(\\d+)、bossHpCurrent為(\\d+)，moveBudget為(\\d+)、movesUsed為(\\d+)$")
    public void encounterClearedWithSettlementStats(int sequence, int bossHpMax, int bossHpCurrent,
                                                    int moveBudget, int movesUsed) {
        if (support.encounter().getSequence() != sequence) {
            support.jumpToEncounter(sequence);
        }
        PveEncounter encounter = support.encounter();
        encounter.setBossHpMax(bossHpMax);
        encounter.setBossHpCurrent(bossHpCurrent);
        encounter.setMoveBudget(moveBudget);
        encounter.setMovesUsed(movesUsed);
        encounter.setStatus(PveEncounterStatus.CLEARED);
        encounter.setClearedAt(Instant.now());
        support.encounters().save(encounter);
    }

    @Given("^玩家 \"([^\"]*)\" 於本關已使用技能 (.+)$")
    public void usedSkillsThisEncounter(String user, String skillsText) {
        for (String skillType : quotedTokens(skillsText)) {
            PveEncounterEvent event = new PveEncounterEvent();
            event.setEncounterId(support.encounterId());
            event.setMoveNumber(support.encounter().getMovesUsed());
            event.setEventType(PveEncounterEventType.SKILL_USED);
            event.setDetail("{\"skillType\":\"" + skillType + "\"}");
            event.setOccurredAt(Instant.now());
            support.events().save(event);
        }
    }

    @Given("^第(\\d+)關手數用盡失敗，movesUsed為(\\d+)、moveBudget為(\\d+)，bossHpCurrent仍大於0$")
    public void encounterFailedWithSettlementStats(int sequence, int movesUsed, int moveBudget) {
        if (support.encounter().getSequence() != sequence) {
            support.jumpToEncounter(sequence);
        }
        PveEncounter encounter = support.encounter();
        encounter.setMovesUsed(movesUsed);
        encounter.setMoveBudget(moveBudget);
        if (encounter.getBossHpCurrent() <= 0) {
            encounter.setBossHpCurrent(10);
        }
        encounter.setStatus(PveEncounterStatus.FAILED);
        encounter.setFailedAt(Instant.now());
        support.encounters().save(encounter);
    }

    @When("^玩家 \"([^\"]*)\" 查詢該關卡狀態$")
    public void queryEncounterStateForResult(String user) {
        ctx.putMemo("pve:encounterResultQuery", support.getEncounterApi(user));
    }

    @Then("^系統回傳 status為 \"([A-Z]+)\"$")
    public void encounterResultStatusIs(String status) {
        Assertions.assertThat(encounterResultQuery().get("status")).isEqualTo(status);
    }

    @Then("^系統回傳的 bossHpMax與bossHpCurrent可推算本關總傷害為(\\d+)$")
    public void encounterResultDamageIs(int damage) {
        Map<String, Object> result = encounterResultQuery();
        int max = ((Number) result.get("bossHpMax")).intValue();
        int current = ((Number) result.get("bossHpCurrent")).intValue();
        Assertions.assertThat(max - current).isEqualTo(damage);
    }

    @Then("^系統回傳的 moveBudget與movesUsed可推算剩餘手數為(\\d+)$")
    public void encounterResultRemainingMovesIs(int remaining) {
        Map<String, Object> result = encounterResultQuery();
        int budget = ((Number) result.get("moveBudget")).intValue();
        int used = ((Number) result.get("movesUsed")).intValue();
        Assertions.assertThat(budget - used).isEqualTo(remaining);
    }

    @Then("^系統回傳已使用技能清單為 (.+)$")
    @SuppressWarnings("unchecked")
    public void encounterResultUsedSkillsAre(String skillsText) {
        List<String> expected = quotedTokens(skillsText);
        List<String> actual = (List<String>) encounterResultQuery().get("usedSkills");
        Assertions.assertThat(actual).containsExactlyElementsOf(expected);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> encounterResultQuery() {
        return (Map<String, Object>) ctx.getMemo("pve:encounterResultQuery");
    }

    private static List<String> quotedTokens(String text) {
        List<String> tokens = new ArrayList<>();
        Matcher m = Pattern.compile("\"([A-Z_]+)\"").matcher(text);
        while (m.find()) {
            tokens.add(m.group(1));
        }
        return tokens;
    }

    // ────────────────────────── 技能使用 ──────────────────────────────────────

    @Given("玩家 {string} 剩餘手數為 {int}，持有技能 {string}")
    public void remainingMovesAndSkill(String user, int remaining, String skillType) {
        PveEncounter encounter = support.encounter();
        encounter.setMovesUsed(encounter.getMoveBudget() - remaining);
        support.encounters().save(encounter);
        support.grantSkill(SkillType.valueOf(skillType), 1);
    }

    @When("玩家 {string} 使用技能 {string}，方向 {string}")
    public void useSkillWithDirection(String user, String skillType, String direction) {
        rememberMovesUsed();
        support.useSkillApi(user, String.format(
                "{\"skillType\":\"%s\",\"direction\":\"%s\",\"anchor\":{\"row\":5,\"col\":5}}",
                skillType, direction));
    }

    @Then("剩餘手數仍為 {int}")
    public void remainingMovesUnchanged(int remaining) {
        PveEncounter encounter = support.encounter();
        Assertions.assertThat(encounter.getMoveBudget() - encounter.getMovesUsed()).isEqualTo(remaining);
    }

    @When("^玩家 \"([^\"]*)\" 使用大絕 \"([^\"]*)\"，錨點 \\((\\d+),(\\d+)\\)，方向 \"([^\"]*)\"$")
    public void useUltimateWithAnchor(String user, String skillType, int row, int col, String direction) {
        rememberMovesUsed();
        support.useSkillApi(user, String.format(
                "{\"skillType\":\"%s\",\"direction\":\"%s\",\"anchor\":{\"row\":%d,\"col\":%d}}",
                skillType, direction, row, col));
    }

    @Then("本次操作不計入落子序列")
    public void castNotCountedAsMove() {
        int before = (int) ctx.getMemo("pve:movesBefore");
        Assertions.assertThat(support.encounter().getMovesUsed()).isEqualTo(before);
    }

    @Given("玩家 {string} 在本間隔已使用過一次技能")
    public void skillAlreadyUsedThisInterval(String user) {
        support.grantSkill(SkillType.VERTICAL_SLASH, 1);
        ResponseEntity<Map> resp = support.useSkillDefault(user, "VERTICAL_SLASH");
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
    }

    @When("玩家 {string} 於同一間隔再次嘗試使用技能")
    public void attemptSecondSkillSameInterval(String user) {
        support.grantSkill(SkillType.HEAVEN_EARTH_REVERSAL, 1);
        support.useSkillDefault(user, "HEAVEN_EARTH_REVERSAL");
    }

    @Given("玩家 {string} 在上一個間隔已使用過技能")
    public void skillUsedInPreviousInterval(String user) {
        skillAlreadyUsedThisInterval(user);
    }

    @When("玩家 {string} 落子後，於新的間隔使用技能")
    public void placeThenUseSkillInNewInterval(String user) {
        support.placeFillers(user, 1);
        support.grantSkill(SkillType.HEAVEN_EARTH_REVERSAL, 1);
        support.useSkillDefault(user, "HEAVEN_EARTH_REVERSAL");
    }

    @Given("第30手落子與全部連鎖結算已完成，關卡已判定")
    public void thirtiethMoveDoneAndJudged() {
        PveEncounter encounter = support.encounter();
        encounter.setMovesUsed(encounter.getMoveBudget());
        encounter.setStatus(PveEncounterStatus.FAILED);
        encounter.setFailedAt(Instant.now());
        support.encounters().save(encounter);
    }

    @When("玩家 {string} 嘗試使用技能")
    public void attemptAnySkill(String user) {
        support.useSkillDefault(user, "HORIZONTAL_SLASH");
    }

    @Given("玩家 {string} 持有技能 {string} 數量 {int}")
    public void holdsSkillWithQuantity(String user, String skillType, int quantity) {
        support.grantSkill(SkillType.valueOf(skillType), quantity);
    }

    @When("玩家 {string} 使用技能 {string}")
    public void useSkillPlain(String user, String skillType) {
        rememberMovesUsed();
        support.useSkillDefault(user, skillType);
    }

    @Then("玩家 {string} 持有技能 {string} 數量降為 {int}")
    public void skillQuantityDropsTo(String user, String skillType, int quantity) {
        Assertions.assertThat(support.skillQuantity(SkillType.valueOf(skillType))).isEqualTo(quantity);
    }

    @Then("技能操作列中 {string} 不再可選")
    @SuppressWarnings("unchecked")
    public void skillNoLongerSelectable(String skillType) {
        Map<String, Object> run = support.getCurrentRunApi(support.user());
        List<Map<String, Object>> held = (List<Map<String, Object>>) run.get("heldSkills");
        Assertions.assertThat(held.stream().anyMatch(s -> skillType.equals(s.get("skillType"))))
                .as("%s must not be selectable anymore", skillType)
                .isFalse();
    }

    @Given("玩家 {string} 未持有技能 {string}")
    public void doesNotHoldSkill(String user, String skillType) {
        support.grantSkill(SkillType.valueOf(skillType), 0);
    }

    @When("玩家 {string} 嘗試使用技能 {string}")
    public void attemptUseSkill(String user, String skillType) {
        support.useSkillDefault(user, skillType);
    }

    @When("玩家使用大絕 \"PIONEER_STAR\" 清除範圍內棋子")
    public void usePioneerStarToClear() {
        String user = support.user();
        // 2026-07-09 魔王對弈與策略引導設計: level 1's real moveBudget dropped
        // 3→2 (re-themed to a single-shape "衝四" teaching level, §3.1) — the
        // 2 ad-hoc placements below now exactly exhaust that budget and would
        // end the encounter (FAILED, moves exhausted) before the skill cast
        // below ever runs. Bump the budget like the other ad-hoc fixtures in
        // this feature already do (see PveCommonSteps#setMoveBudget javadoc).
        support.setMoveBudget(100);
        placeAll(List.of(new int[]{4, 6}, new int[]{5, 6}));
        support.grantSkill(SkillType.PIONEER_STAR, 1);
        ctx.putMemo("pve:hpBefore", support.encounter().getBossHpCurrent());
        // 2026-07-10 flaky root-cause fix: the shared useSkillDefault anchor is
        // (5,5) — dead center, which is exactly where the (all-DUEL now) boss's
        // reply moves cluster (BossAiPolicy layer 7/8 center preference with a
        // seeded top-K random pick). Depending on the RNG draw the boss's two
        // replies to the placements above sometimes took (5,5) itself, failing
        // the cast with 422 "大絕錨點格必須為空格" — an intermittent, seed-
        // boundary failure. (0,0) is structurally unreachable within two boss
        // replies (candidates stay within Chebyshev<=2 of existing stones near
        // the center), so the anchor is deterministically empty — stronger
        // than pinning a seed.
        ResponseEntity<Map> resp = support.useSkillApi(user,
                "{\"skillType\":\"PIONEER_STAR\",\"direction\":\"RIGHT\",\"anchor\":{\"row\":0,\"col\":0}}");
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("pioneer star cast must succeed: %s", resp.getBody())
                .isTrue();
    }

    @Then("該次清除不直接對Boss造成傷害")
    public void clearDealsNoDirectDamage() {
        int before = (int) ctx.getMemo("pve:hpBefore");
        Assertions.assertThat(support.encounter().getBossHpCurrent()).isEqualTo(before);
    }

    @Then("若清除或推移後另形成連線，依連線傷害結算規則另行計傷")
    public void linesAfterSkillSettleNormally() {
        // No line was formed here — the settlement pipeline reports 0 damage;
        // line formation after skills is covered by the push/line features.
        Map<String, Object> resolution = support.lastResolution();
        if (resolution != null) {
            Assertions.assertThat(((Number) resolution.get("damageDealt")).intValue()).isEqualTo(0);
        }
    }

    private void rememberMovesUsed() {
        ctx.putMemo("pve:movesBefore", support.encounter().getMovesUsed());
    }
}
