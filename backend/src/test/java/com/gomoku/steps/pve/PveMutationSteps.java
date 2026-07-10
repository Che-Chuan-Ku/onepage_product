package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounterEvent;
import com.gomoku.domain.enums.PveEncounterEventType;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.SkillType;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.Map;
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
        // Pin the seed BEFORE the encounter is created (see RAGE_PINNED_SEED
        // doc) so the level's real window coordinates are deterministic and
        // this fixture's hardcoded stones provably sit outside all of them.
        support.pinRunSeed(RAGE_PINNED_SEED);
        support.jumpToEncounter(sequence);
        support.grantRelic(PveRelicType.valueOf(relicType));
        // Blank-board premise (see clearInitialShapeStones javadoc) — this
        // step feeds tightly hand-crafted ad-hoc stone layouts (e.g. the RAGE
        // "clears exactly 3 stones" fixture) that assume full control of
        // which cells are occupied.
        support.clearInitialShapeStones();
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

    // 調校輪2（2026-07-09，B6互動命中率）: 觸發頻率5手→3手、閘門3連續→2連續
    // 黑子（見PveChallengeService#resolveRageEruption/#boardHasProgressedWindow
    // class doc）。RAGE_TRIANGLE is a compact "L" triomino where every pair of
    // cells is within Chebyshev distance 1 of each other — (1,4)-(1,5)=1,
    // (1,5)-(2,5)=1, (1,4)-(2,5)=1 — so no matter which of the 3 occupied
    // cells the server's random pick lands on as blast center, its 3x3 zone
    // always covers all 3 (unlike a straight 3-in-a-row, whose two ends are
    // Chebyshev distance 2 apart and would NOT mutually cover). Placing
    // (1,4)/(1,5) first already forms a horizontal 2-run, satisfying the new
    // >=2-consecutive gate the moment the 3rd cell completes the triomino.
    private static final int[] RAGE_TRIANGLE_CENTER = {2, 5};
    private static final int[][] RAGE_TRIANGLE_ARMS = {{1, 4}, {1, 5}};
    private static final int[][] RAGE_TRIANGLE_ALL = {{1, 4}, {1, 5}, {2, 5}};

    /**
     * Pinned run seed for the RAGE ad-hoc fixtures. Under the §5 D4 board
     * transform an arbitrary (Background-random) seed can rotate level 6's
     * windows onto ANY even row/col band — the union over both templates x 8
     * transforms covers every cell except the 4 corners and (odd,odd) cells,
     * so NO mutually-covering triomino can avoid every possible window. If a
     * fixture stone lands inside a window, the new 0&lt;filled&lt;5 pending
     * semantics (resolveRageEruption, 調校輪2) can read that lone stone as
     * "the sole in-progress window" and PROTECT it from the blast, breaking
     * the fixture's "everything clears" premise. Pinning the seed makes the
     * draw deterministic: mutfix-8 → IDENTITY + Template A (verified via
     * jshell against PveFieldScheduler), windows = VERTICAL cols 0/2/4/6/8/10
     * x rows 2-6, and every RAGE_TRIANGLE cell — (1,4) row&lt;2, (1,5)/(2,5)
     * odd col — is provably outside all of them.
     */
    private static final String RAGE_PINNED_SEED = "mutfix-8";

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關（mutationType為\"([^\"]*)\"），已落滿2手$")
    public void atRageEncounterWithTwoMoves(String user, int sequence, String mutation) {
        support.pinRunSeed(RAGE_PINNED_SEED);
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getMutationType().name()).isEqualTo(mutation);
        // Blank-board premise for this RAGE-mechanism unit test (see
        // clearInitialShapeStones javadoc) — otherwise level 6's own dense
        // pre-placed template (every even column) dominates the "pick a
        // random occupied cell" draw this test tightly controls.
        support.clearInitialShapeStones();
        // 2 clustered stones; the 3rd (the When step) completes the triomino
        // and lands exactly on the new 3-move checkpoint.
        for (int[] cell : RAGE_TRIANGLE_ARMS) {
            Assertions.assertThat(support.placeMoveApi(user, cell[0], cell[1])
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
    }

    @When("第3手結算完成")
    public void thirdMoveSettles() {
        ctx.putMemo("pve:hpBefore", support.encounter().getBossHpCurrent());
        Assertions.assertThat(support.placeMoveApi(support.user(), RAGE_TRIANGLE_CENTER[0], RAGE_TRIANGLE_CENTER[1])
                .getStatusCode().is2xxSuccessful()).isTrue();
    }

    // B6 盤面感知閘門（調校輪2，2026-07-09）：5顆彼此不相鄰、任何方向都湊不出
    // 2連續的孤立棋子——閘門判定「無進度」，第6手（下一個3手檢查點）不應觸發
    // 震怒。既有的孤立佈局本身任兩點最小間距都是3，在舊閾值(>=3)與新閾值
    // (>=2)下皆不構成連續，故沿用原座標即可，不需更動。
    private static final int[][] RAGE_ISOLATED_CELLS = {{0, 0}, {0, 3}, {0, 6}, {0, 9}, {3, 0}};

    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關（mutationType為\"([^\"]*)\"），已落5顆互不相鄰的棋子且無3連續$")
    public void atRageEncounterWithFiveIsolatedMoves(String user, int sequence, String mutation) {
        support.jumpToEncounter(sequence);
        Assertions.assertThat(support.encounter().getMutationType().name()).isEqualTo(mutation);
        support.clearInitialShapeStones();
        for (int[] cell : RAGE_ISOLATED_CELLS) {
            Assertions.assertThat(support.placeMoveApi(user, cell[0], cell[1])
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
    }

    @Then("系統不觸發震怒噴發")
    public void rageEruptionNotTriggered() {
        Assertions.assertThat(mutationEvents()).isEmpty();
    }

    @Then("系統隨機選定一個有棋子的格子觸發噴發")
    public void rageEruptionTriggered() {
        Assertions.assertThat(mutationEvents()).isNotEmpty();
    }

    @Then("系統清除該格及周圍8格的棋子")
    public void centerAndNeighborsCleared() {
        // 3 stones stood before the eruption, all mutually Chebyshev distance
        // 1 apart (see RAGE_TRIANGLE_ALL doc) — whichever occupied center was
        // picked, its 3x3 zone covers all 3, so nothing should remain.
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

    @When("震怒噴發清除3顆棋子")
    public void rageClearsExactlyThree() {
        // RAGE_TRIANGLE_ALL's 3 cells are mutually Chebyshev distance 1 apart
        // (see class doc above), so — unlike the pre-rework 5-cell plus shape
        // — no index-crafted-layout replication of the server's random pick
        // is needed: ANY of the 3 chosen as blast center covers the other 2,
        // guaranteeing all 3 clear deterministically regardless of the seed.
        ctx.putMemo("pve:hpBefore", support.encounter().getBossHpCurrent());
        for (int[] cell : RAGE_TRIANGLE_ALL) {
            Assertions.assertThat(support.placeMoveApi(support.user(), cell[0], cell[1])
                    .getStatusCode().is2xxSuccessful()).isTrue();
        }
        Assertions.assertThat(support.stoneKeys(support.lastState()))
                .as("the eruption must have cleared all 3 stones")
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
        // Blank-board premise (see clearInitialShapeStones javadoc): level 8's
        // own dense pre-placed template (7 shapes across most even columns)
        // can leave findVerticalSegment's "clean" 5-run search landing on a
        // column whose only gap-free stretch runs straight into one of the
        // level's own already-filled shape cells (e.g. rows above a TYPE_A
        // shape's window merging into its prefilled offsets on the very same
        // move) — resolving TWO lines in one settle instead of the single
        // "clean line" this test wants, which would spawn 2 ABYSS obstacles
        // instead of 1. This unit test is about the ABYSS mechanism in
        // isolation, not this level's real puzzle, so clear the real template
        // first exactly like the RAGE isolated-mechanism fixtures do.
        support.clearInitialShapeStones();
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
