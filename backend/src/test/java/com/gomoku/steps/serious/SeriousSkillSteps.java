package com.gomoku.steps.serious;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.FieldEvent;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.FieldEventType;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.game.FieldEventDetail;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;

/**
 * Steps for 劍士技能組 / 弓箭手技能組 / 推擠解算器（共用元件）.
 * alice = WARRIOR/BLACK, bob = ARCHER/WHITE.
 */
public class SeriousSkillSteps {

    @Autowired
    private ScenarioContext ctx;
    @Autowired
    private SeriousCommonSteps support;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ================================================================
    // 劍士技能組
    // ================================================================

    /**
     * Slash attach without pre-seeded stones in the feature: seed the slash
     * zone with enemy stones so the push assertions are observable —
     * HORIZONTAL_SLASH: the 3 adjacent cells; VERTICAL_SLASH: only the single
     * adjacent cell (1-wide, rule change 2026-07-07).
     */
    @When("玩家 {string} 於 \\({int},{int}\\) 落子並附掛 {string}，方向 {string}")
    public void placeWithSlash(String user, int row, int col, String skill, String direction) {
        boolean horizontal = "HORIZONTAL_SLASH".equals(skill);
        int dr = "UP".equals(direction) ? -1 : "DOWN".equals(direction) ? 1 : 0;
        int dc = "LEFT".equals(direction) ? -1 : "RIGHT".equals(direction) ? 1 : 0;
        if (horizontal) {
            for (int side = -1; side <= 1; side++) {
                support.insertStone(StoneColor.WHITE, row + dr, col + side);
            }
        } else {
            support.insertStone(StoneColor.WHITE, row, col + dc);
        }
        support.ensureTurn(user);
        support.placeAs(user, String.format(
                "{\"row\":%d,\"col\":%d,\"skill\":{\"skillType\":\"%s\",\"direction\":\"%s\"}}",
                row, col, skill, direction));
    }

    @Then("系統對 \\({int},{int}\\),\\({int},{int}\\),\\({int},{int}\\) 這一橫排施加往上推 1 格")
    public void horizontalRowPushedUp(int r1, int c1, int r2, int c2, int r3, int c3) {
        assertPushedFrom(new int[][]{{r1, c1}, {r2, c2}, {r3, c3}});
    }

    /** VERTICAL_SLASH is 1-wide (rule change 2026-07-07): exactly one pushed cell. */
    @Then("系統對 \\({int},{int}\\) 這一格施加往左推 1 格")
    public void singleCellPushedLeft(int r1, int c1) {
        assertPushedFrom(new int[][]{{r1, c1}});
        // 1-wide: no other slash push may have happened this settlement.
        Assertions.assertThat(pushedDetails()).hasSize(1);
    }

    @And("系統發布 SkillUsed 與 StonesPushed 事件")
    public void skillUsedAndStonesPushedPublished() {
        Assertions.assertThat(support.anySkillUsageRecorded()).isTrue();
        Assertions.assertThat(support.eventsOfType(FieldEventType.STONE_PUSHED)).isNotEmpty();
    }

    @Given("\\({int},{int}\\) 已有棋子")
    public void cellHasStone(int row, int col) {
        support.insertStone(StoneColor.WHITE, row, col);
    }

    /** Ultimate cast without direction (feature: anchor-occupied rejections). */
    @When("玩家 {string} 施放大絕 {string}，錨點 \\({int},{int}\\)")
    public void castUltimateWithoutDirection(String user, String skill, int row, int col) {
        support.ensureTurn(user);
        support.placeAs(user, String.format(
                "{\"skill\":{\"skillType\":\"%s\",\"anchor\":{\"row\":%d,\"col\":%d}}}",
                skill, row, col));
    }

    @Given("空格 \\({int},{int}\\) 為錨點，方向 {string}")
    public void emptyAnchorWithDirection(int row, int col, String direction) {
        ctx.putMemo("anchorRow", row);
        ctx.putMemo("anchorCol", col);
        ctx.putMemo("anchorDirection", direction);
    }

    @And("範圍內 \\({int},{int}\\),\\({int},{int}\\),\\({int},{int}\\),\\({int},{int}\\) 各有棋子")
    public void zoneCellsHaveStones(int r1, int c1, int r2, int c2, int r3, int c3, int r4, int c4) {
        // Mixed colors so a swap is observable; positions from the feature.
        support.insertStone(StoneColor.BLACK, r1, c1);
        support.insertStone(StoneColor.WHITE, r2, c2);
        support.insertStone(StoneColor.BLACK, r3, c3);
        support.insertStone(StoneColor.WHITE, r4, c4);
        ctx.putMemo("zoneCells", new int[][]{{r1, c1}, {r2, c2}, {r3, c3}, {r4, c4}});
    }

    @Then("範圍內棋子顏色雙方互換")
    public void zoneColorsSwapped() {
        List<FieldEvent> events = support.eventsOfType(FieldEventType.COLORS_SWAPPED);
        Assertions.assertThat(events).isNotEmpty();
        FieldEventDetail detail = parseDetail(events.get(events.size() - 1));
        Assertions.assertThat(detail.cells()).hasSize(4);
        for (FieldEventDetail cell : detail.cells()) {
            Assertions.assertThat(cell.fromColor()).isNotEqualTo(cell.toColor());
        }
    }

    @And("系統發布 ColorsSwapped 事件")
    public void colorsSwappedPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.COLORS_SWAPPED)).isNotEmpty();
    }

    // ================================================================
    // 弓箭手技能組
    // ================================================================

    @Given("\\({int},{int}\\) 為敵方棋子且現存於棋盤上")
    public void enemyStoneExists(int row, int col) {
        // bob (ARCHER, WHITE) acts — the enemy stone is BLACK.
        support.insertStone(StoneColor.BLACK, row, col);
    }

    @When("玩家 {string} 使用技能 {string} 指定 \\({int},{int}\\)")
    public void useSkillTargeting(String user, String skill, int row, int col) {
        support.ensureTurn(user);
        support.placeAs(user, String.format(
                "{\"row\":%d,\"col\":%d,\"skill\":{\"skillType\":\"%s\"}}", row, col, skill));
    }

    @And("\\({int},{int}\\) 的棋子顏色替換為 {string} 的顏色")
    public void stoneReplacedWithUsersColor(int row, int col, String user) {
        List<FieldEvent> events = support.eventsOfType(FieldEventType.STONE_REPLACED);
        Assertions.assertThat(events).isNotEmpty();
        FieldEvent last = events.get(events.size() - 1);
        Assertions.assertThat(last.getRow()).isEqualTo(row);
        Assertions.assertThat(last.getCol()).isEqualTo(col);
        String expectedColor = "alice".equals(user) ? "BLACK" : "WHITE";
        Assertions.assertThat(parseDetail(last).toColor()).isEqualTo(expectedColor);
    }

    @And("該次替換視為 {string} 本回合落子")
    public void replacementConsumesTurn(String user) {
        // Turn has passed to the opponent.
        Assertions.assertThat(support.currentTurnUser()).isNotEqualTo(user);
    }

    @And("系統發布 SkillUsed 與 StoneReplaced 事件")
    public void skillUsedAndStoneReplacedPublished() {
        Assertions.assertThat(support.anySkillUsageRecorded()).isTrue();
        Assertions.assertThat(support.eventsOfType(FieldEventType.STONE_REPLACED)).isNotEmpty();
    }

    @Given("\\({int},{int}\\) 原有的敵方棋子已被燒毀")
    public void enemyStoneWasBurned(int row, int col) {
        // Burned = no longer on the board: simply ensure the cell is empty.
        // (Nothing to insert; the snipe below must be rejected.)
    }

    @When("玩家 {string} 使用技能 {string} 於 \\({int},{int}\\) 與 \\({int},{int}\\)")
    public void useScatterShot(String user, String skill, int r1, int c1, int r2, int c2) {
        support.ensureTurn(user);
        support.placeAs(user, String.format(
                "{\"row\":%d,\"col\":%d,\"skill\":{\"skillType\":\"%s\",\"secondStone\":{\"row\":%d,\"col\":%d}}}",
                r1, c1, skill, r2, c2));
    }

    @And("\\({int},{int}\\) 與 \\({int},{int}\\) 同時落下 {string} 的棋子")
    public void bothStonesPlaced(int r1, int c1, int r2, int c2, String user) {
        ResponseEntity<?> resp = ctx.getLastResponse();
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        StoneColor color = "alice".equals(user) ? StoneColor.BLACK : StoneColor.WHITE;
        Assertions.assertThat(support.stoneColorAt(r1, c1)).isEqualTo(color);
        Assertions.assertThat(support.stoneColorAt(r2, c2)).isEqualTo(color);
    }

    @Then("範圍內棋子全部被消除")
    public void zoneStonesCleared() {
        List<FieldEvent> events = support.eventsOfType(FieldEventType.STONES_CLEARED);
        Assertions.assertThat(events).isNotEmpty();
        FieldEventDetail detail = parseDetail(events.get(events.size() - 1));
        Assertions.assertThat(detail.cells()).hasSize(4);
        int[][] zone = (int[][]) ctx.getMemo("zoneCells");
        for (int[] cell : zone) {
            Assertions.assertThat(support.stoneColorAt(cell[0], cell[1])).isNull();
        }
    }

    @And("系統發布 StonesCleared 事件")
    public void stonesClearedPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.STONES_CLEARED)).isNotEmpty();
    }

    // ================================================================
    // 推擠解算器（共用元件）— feature has no Background; Givens self-provision
    // ================================================================

    @Given("一列棋子於 \\({int},{int}\\),\\({int},{int}\\),\\({int},{int}\\) 皆有子")
    public void rowOfStones(int r1, int c1, int r2, int c2, int r3, int c3) {
        support.createSeriousGame("VOLCANO", "WARRIOR", "ARCHER");
        support.clearFieldCells();
        support.insertStone(StoneColor.WHITE, r1, c1);
        support.insertStone(StoneColor.WHITE, r2, c2);
        support.insertStone(StoneColor.WHITE, r3, c3);
        ctx.putMemo("lineHeadRow", r1);
        ctx.putMemo("lineHeadCol", c1);
    }

    /** Drive the shared resolver through a vertical slash aimed at the line head. */
    @When("推擠解算器對該列施加方向 {string} 推力")
    public void resolverPushesLine(String direction) {
        int headRow = (Integer) ctx.getMemo("lineHeadRow");
        int headCol = (Integer) ctx.getMemo("lineHeadCol");
        // VERTICAL_SLASH is 1-wide (rule change 2026-07-07): place directly
        // behind the line head (opposite the push direction) so the single
        // adjacent cell IS the head — the chain then pushes the whole line.
        int dc = "LEFT".equals(direction) ? -1 : 1;
        support.ensureTurn("alice");
        support.placeAs("alice", String.format(
                "{\"row\":%d,\"col\":%d,\"skill\":{\"skillType\":\"VERTICAL_SLASH\",\"direction\":\"%s\"}}",
                headRow, headCol - dc, direction));
        Assertions.assertThat(((ResponseEntity<?>) ctx.getLastResponse())
                .getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Then("\\({int},{int}\\) 的子移至 \\({int},{int}\\)，\\({int},{int}\\) 的子移至 \\({int},{int}\\)，\\({int},{int}\\) 的子移至 \\({int},{int}\\)")
    public void stonesMovedTo(int fr1, int fc1, int tr1, int tc1,
                              int fr2, int fc2, int tr2, int tc2,
                              int fr3, int fc3, int tr3, int tc3) {
        List<int[]> expected = List.of(
                new int[]{fr1, fc1, tr1, tc1},
                new int[]{fr2, fc2, tr2, tc2},
                new int[]{fr3, fc3, tr3, tc3});
        List<FieldEventDetail> pushes = pushedDetails();
        for (int[] move : expected) {
            boolean found = pushes.stream().anyMatch(d ->
                    d.fromRow() == move[0] && d.fromCol() == move[1]
                            && d.toRow() == move[2] && d.toCol() == move[3]);
            Assertions.assertThat(found)
                    .as("stone (%d,%d) must move to (%d,%d)", move[0], move[1], move[2], move[3])
                    .isTrue();
        }
    }

    @And("系統發布 StonesPushed 事件")
    public void stonesPushedPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.STONE_PUSHED)).isNotEmpty();
    }

    @Given("\\({int},{int}\\) 有一顆棋子，推擠方向為 {string}（棋盤欄範圍 0..14）")
    public void edgeStoneWithPushDirection(int row, int col, String direction) {
        support.createSeriousGame("VOLCANO", "WARRIOR", "ARCHER");
        support.clearFieldCells();
        support.insertStone(StoneColor.WHITE, row, col);
        ctx.putMemo("lineHeadRow", row);
        ctx.putMemo("lineHeadCol", col);
        ctx.putMemo("pushDirection", direction);
    }

    @When("推擠解算器對該列施加推力")
    public void resolverPushes() {
        resolverPushesLine(String.valueOf(ctx.getMemo("pushDirection")));
    }

    @Then("\\({int},{int}\\) 的棋子被移除")
    public void stoneRemoved(int row, int col) {
        List<FieldEvent> removed = support.eventsOfType(FieldEventType.STONE_REMOVED_OFF_BOARD);
        Assertions.assertThat(removed).isNotEmpty();
        FieldEvent last = removed.get(removed.size() - 1);
        Assertions.assertThat(last.getRow()).isEqualTo(row);
        Assertions.assertThat(last.getCol()).isEqualTo(col);
        Assertions.assertThat(support.stoneColorAt(row, col)).isNull();
    }

    @And("系統發布 StoneRemovedOffBoard 事件")
    public void stoneRemovedOffBoardPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.STONE_REMOVED_OFF_BOARD)).isNotEmpty();
    }

    @Given("一列棋子與方向路徑中包含一個障礙物格")
    public void lineWithObstacleInPath() {
        support.createSeriousGame("VOLCANO", "WARRIOR", "ARCHER");
        support.clearFieldCells();
        support.insertStone(StoneColor.WHITE, 7, 5);
        support.insertStone(StoneColor.WHITE, 7, 6);
        support.insertFieldCell(FieldCellKind.OBSTACLE, 7, 7, true);
        ctx.putMemo("lineHeadRow", 7);
        ctx.putMemo("lineHeadCol", 5);
        ctx.putMemo("pushDirection", "RIGHT");
    }

    @Then("該列所有棋子維持原位")
    public void lineStaysPut() {
        Assertions.assertThat(support.stoneColorAt(7, 5)).isNotNull();
        Assertions.assertThat(support.stoneColorAt(7, 6)).isNotNull();
    }

    @And("不發布 StonesPushed 事件")
    public void noStonesPushedPublished() {
        Assertions.assertThat(support.eventsOfType(FieldEventType.STONE_PUSHED)).isEmpty();
    }

    @Given("海浪觸發對沙灘方向的推擠")
    public void waveTriggersPush() {
        support.createSeriousGame("BEACH", "WARRIOR", "ARCHER");
        support.clearFieldCells();
        var state = support.fieldState();
        state.setSeaSide(com.gomoku.domain.enums.BoardSide.NORTH);
        state.setRoundCounter(9);
        support.saveFieldState(state);
        support.insertStone(StoneColor.WHITE, 1, 7); // ocean stone
    }

    @When("推擠解算器結算")
    public void resolverSettlesWave() {
        support.ensureTurn("alice");
        support.placeAs("alice", "{\"row\":12,\"col\":3}"); // 10th hand → wave surges
        Assertions.assertThat(((ResponseEntity<?>) ctx.getLastResponse())
                .getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Then("其連鎖與越界移除規則與橫劈\\/縱劈完全一致")
    public void sameRulesAsSlashes() {
        // Behavioral evidence of the shared resolver: the wave produced the same
        // STONE_PUSHED event stream as slashes do ((1,7) → (2,7) toward the sand).
        boolean found = pushedDetails().stream().anyMatch(d ->
                d.fromRow() == 1 && d.fromCol() == 7 && d.toRow() == 2 && d.toCol() == 7);
        Assertions.assertThat(found).as("wave must chain-push the ocean stone").isTrue();
    }

    // ================================================================
    // helpers
    // ================================================================

    private void assertPushedFrom(int[][] fromCells) {
        List<FieldEventDetail> pushes = pushedDetails();
        for (int[] from : fromCells) {
            boolean found = pushes.stream().anyMatch(d ->
                    d.fromRow() == from[0] && d.fromCol() == from[1]);
            Assertions.assertThat(found)
                    .as("stone at (%d,%d) must have been pushed", from[0], from[1])
                    .isTrue();
        }
    }

    private List<FieldEventDetail> pushedDetails() {
        List<FieldEventDetail> details = new ArrayList<>();
        for (FieldEvent e : support.eventsOfType(FieldEventType.STONE_PUSHED)) {
            details.add(parseDetail(e));
        }
        return details;
    }

    private FieldEventDetail parseDetail(FieldEvent event) {
        try {
            return objectMapper.readValue(event.getDetail(), FieldEventDetail.class);
        } catch (Exception e) {
            throw new AssertionError("unparseable event detail: " + event.getDetail(), e);
        }
    }
}
