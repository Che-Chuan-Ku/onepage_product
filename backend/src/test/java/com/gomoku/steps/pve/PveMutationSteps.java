package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounterEvent;
import com.gomoku.domain.enums.PveEncounterEventType;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.game.PveRandoms;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/** Steps for features/pve/Boss突變.feature (FR-C6). */
public class PveMutationSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;

    // ────────────────────────── encounter jumps ──────────────────────────────

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關（mutationType為\"([^\"]*)\"）$")
    public void atEncounterWithMutation(String user, int sequence, String mutation) {
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getMutationType().name()).isEqualTo(mutation);
    }

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關$")
    public void atEncounter(String user, int sequence) {
        support.jumpToEncounter(sequence);
    }

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關，持有遺物 \"([^\"]*)\"$")
    public void atEncounterWithRelic(String user, int sequence, String relicType) {
        support.jumpToEncounter(sequence);
        support.grantRelic(PveRelicType.valueOf(relicType));
    }

    // ────────────────────────── ONE_EYE ──────────────────────────────────────

    @When("玩家形成橫向五連")
    public void playerFormsHorizontalFive() {
        ctx.putMemo("pve:hpBefore", support.encounter().getBossHpCurrent());
        for (int c = 3; c <= 7; c++) {
            Assertions.assertThat(support.placeMoveApi(support.user(), 5, c)
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
        ctx.putMemo("pve:lineCells", new int[][]{{5, 3}, {5, 4}, {5, 5}, {5, 6}, {5, 7}});
    }

    @Then("該橫向連線不造成傷害")
    public void horizontalLineDealsNoDamage() {
        int before = (int) ctx.getMemo("pve:hpBefore");
        Assertions.assertThat(support.encounter().getBossHpCurrent()).isEqualTo(before);
    }

    @Then("該五連棋子不被移除")
    public void lineStonesNotRemoved() {
        Set<Long> stones = support.stoneKeys(support.lastState());
        for (int[] cell : (int[][]) ctx.getMemo("pve:lineCells")) {
            Assertions.assertThat(stones).contains(PveCommonSteps.key(cell[0], cell[1]));
        }
    }

    @When("玩家形成縱向五連")
    public void playerFormsVerticalFive() {
        ctx.putMemo("pve:hpBefore", support.encounter().getBossHpCurrent());
        support.playCleanVerticalLine(support.user());
    }

    @Then("系統正常結算該連線傷害")
    public void lineSettledNormally() {
        int before = (int) ctx.getMemo("pve:hpBefore");
        Assertions.assertThat(support.encounter().getBossHpCurrent()).isLessThan(before);
        Assertions.assertThat(support.resolvedLines()).isNotEmpty();
    }

    // ────────────────────────── RAGE ─────────────────────────────────────────

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關（mutationType為\"([^\"]*)\"），已落滿5手$")
    public void atRageEncounterWithFourMoves(String user, int sequence, String mutation) {
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getMutationType().name()).isEqualTo(mutation);
        // 4 clustered stones; the 5th (the When step) completes the plus shape.
        for (int[] cell : new int[][]{{4, 5}, {5, 4}, {5, 6}, {6, 5}}) {
            Assertions.assertThat(support.placeMoveApi(user, cell[0], cell[1])
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
    }

    @When("第5手結算完成")
    public void fifthMoveSettles() {
        ctx.putMemo("pve:hpBefore", support.encounter().getBossHpCurrent());
        Assertions.assertThat(support.placeMoveApi(support.user(), 5, 5)
                .getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Then("系統隨機選定一個有棋子的格子觸發噴發")
    public void rageEruptionTriggered() {
        Assertions.assertThat(mutationEvents()).isNotEmpty();
    }

    @Then("系統清除該格及周圍8格的棋子")
    public void centerAndNeighborsCleared() {
        // 5 stones stood before the eruption; whichever occupied center was
        // picked, its 3x3 zone covers at least 4 of the plus shape.
        Assertions.assertThat(support.stoneKeys(support.lastState()).size()).isLessThanOrEqualTo(1);
    }

    @Then("該次清除不對Boss造成傷害")
    public void rageClearDealsNoDamage() {
        int before = (int) ctx.getMemo("pve:hpBefore");
        Assertions.assertThat(support.encounter().getBossHpCurrent()).isEqualTo(before);
    }

    @Then("系統發布 BossMutationTriggered 事件")
    public void bossMutationPublished() {
        Assertions.assertThat(mutationEvents()).isNotEmpty();
    }

    @When("震怒噴發清除5顆棋子")
    public void rageClearsExactlyFive() {
        // Replicate the service's seeded pick (PveRandoms "rage:<runMove>") to
        // lay 5 stones whose all-covering cell is exactly the picked center —
        // deterministic per FR-A3, so the eruption clears exactly 5 stones.
        String seed = support.run().getSeed();
        int pickIndex = new Random(PveRandoms.deriveSeed(seed, "rage:5")).nextInt(5);
        int[][][] layouts = {
                {{4, 4}, {4, 5}, {5, 3}, {5, 4}, {5, 5}}, // covering center at sort index 0: (4,4)
                {{4, 3}, {4, 4}, {5, 3}, {5, 4}, {5, 5}}, // index 1: (4,4)
                {{4, 5}, {5, 4}, {5, 5}, {5, 6}, {6, 5}}, // index 2: (5,5)
                {{4, 4}, {4, 5}, {4, 6}, {5, 5}, {6, 5}}, // index 3: (5,5)
                {{4, 4}, {4, 5}, {4, 6}, {5, 4}, {5, 5}}, // index 4: (5,5)
        };
        ctx.putMemo("pve:hpBefore", support.encounter().getBossHpCurrent());
        for (int[] cell : layouts[pickIndex]) {
            Assertions.assertThat(support.placeMoveApi(support.user(), cell[0], cell[1])
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
        Assertions.assertThat(support.stoneKeys(support.lastState()))
                .as("the eruption must have cleared all 5 stones")
                .isEmpty();
    }

    @Then("^系統依火山之心效果對Boss造成傷害 (\\d+)（每顆10）$")
    public void volcanoHeartDamage(int damage) {
        int before = (int) ctx.getMemo("pve:hpBefore");
        Assertions.assertThat(before - support.encounter().getBossHpCurrent()).isEqualTo(damage);
    }

    // ────────────────────────── ABYSS ────────────────────────────────────────

    @When("玩家完成一次連線結算")
    public void playerCompletesLineResolution() {
        support.playCleanVerticalLine(support.user());
    }

    @Then("系統於一個隨機空格生成1顆障礙棋子")
    public void obstacleStoneGenerated() {
        Set<Long> obstacles = support.obstacleKeys(support.lastState());
        Assertions.assertThat(obstacles).hasSize(1);
        ctx.putMemo("pve:abyssCell", obstacles.iterator().next());
    }

    @Then("該障礙棋子不可落子、不可作為連線組成")
    public void obstacleStoneNotPlayable() {
        long key = (long) ctx.getMemo("pve:abyssCell");
        Assertions.assertThat(support.placeMoveApi(
                        support.user(), (int) (key / 100), (int) (key % 100))
                .getStatusCode().is2xxSuccessful()).isFalse();
    }

    @Given("^第8關棋盤上 \\((\\d+),(\\d+)\\) 為深淵生成的障礙棋子$")
    public void abyssObstacleAt(int row, int col) {
        if (support.encounter().getSequence() != 8) {
            support.jumpToEncounter(8);
        }
        PveEncounterEvent event = new PveEncounterEvent();
        event.setEncounterId(support.encounterId());
        event.setMoveNumber(support.encounter().getMovesUsed());
        event.setEventType(PveEncounterEventType.BOSS_MUTATION_TRIGGERED);
        event.setRow(row);
        event.setCol(col);
        event.setDetail("{\"mutation\":\"ABYSS\"}");
        event.setOccurredAt(Instant.now());
        support.events().save(event);
    }

    @When("^玩家使用橫劈技能推擠涵蓋 \\((\\d+),(\\d+)\\) 的一排$")
    public void slashPushCoveringCell(int row, int col) {
        support.grantSkill(SkillType.HORIZONTAL_SLASH, 1);
        var resp = support.useSkillApi(support.user(), String.format(
                "{\"skillType\":\"HORIZONTAL_SLASH\",\"direction\":\"UP\",\"anchor\":{\"row\":%d,\"col\":%d}}",
                row + 1, col));
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("slash cast must succeed: %s", resp.getBody())
                .isTrue();
        ctx.putMemo("pve:pushedFrom", new int[]{row, col});
    }

    @Then("^\\((\\d+),(\\d+)\\) 的障礙棋子依推擠解算器規則被推移$")
    public void obstacleStonePushed(int row, int col) {
        Set<Long> obstacles = support.obstacleKeys(support.lastState());
        Assertions.assertThat(obstacles)
                .doesNotContain(PveCommonSteps.key(row, col))
                .contains(PveCommonSteps.key(row - 1, col));
    }

    private List<PveEncounterEvent> mutationEvents() {
        return support.events().findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                support.encounterId(), PveEncounterEventType.BOSS_MUTATION_TRIGGERED);
    }
}
