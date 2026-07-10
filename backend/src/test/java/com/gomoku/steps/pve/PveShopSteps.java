package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.entity.PveShopOfferSlot;
import com.gomoku.domain.entity.PveShopVisit;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.PveRunStatus;
import com.gomoku.domain.enums.PveShopOfferKind;
import com.gomoku.domain.enums.PveShopVisitStatus;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.repository.PveShopOfferSlotRepository;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

/** Steps for features/pve/金幣與商店.feature (FR-C3 FR-C4). */
public class PveShopSteps {

    @Autowired private PveCommonSteps support;
    @Autowired private ScenarioContext ctx;
    @Autowired private PveShopOfferSlotRepository slotRepository;

    // ────────────────────────── gold ─────────────────────────────────────────

    @Given("玩家 {string} 於第1關剩餘手數為 {int} 時通過")
    public void clearsFirstEncounterWithRemaining(String user, int remaining) {
        // Clears via the level's OWN designed solution (documents/PVE-關卡
        // 重設計-2026-07-08.md), not an unrelated 5-line — several levels'
        // real move budgets are now too small to fit a whole extra line.
        // Disarmed: this scenario asserts an EXACT final movesUsed, which a
        // minor-disruption repair move (see disableMinorDisruption javadoc)
        // would throw off.
        support.disableMinorDisruption();
        int budget = support.encounter().getMoveBudget();
        int solutionMoves = support.currentEncounterSolutionMoveCount();
        int filler = budget - remaining - solutionMoves;
        Assertions.assertThat(filler)
                .as("requested remaining=%d must be reachable within this level's real budget=%d and solution size=%d",
                        remaining, budget, solutionMoves)
                .isGreaterThanOrEqualTo(0);
        if (filler > 0) {
            support.placeSafeFillers(user, filler);
        }
        support.completeCurrentEncounterShapes(user);
        Assertions.assertThat(support.encounter().getStatus().name()).isEqualTo("CLEARED");
        Assertions.assertThat(support.encounter().getMovesUsed())
                .isEqualTo(support.encounter().getMoveBudget() - remaining);
    }

    /**
     * documents/PVE-全對弈階梯設計-2026-07-10.md §5.1: all 8 levels are DUEL
     * now — there is no "designed solution" to complete anymore, so directly
     * force-clear through the real economy side effects
     * ({@link PveCommonSteps#forceWinCurrentDuelEncounter}) after pinning
     * movesUsed to reach the requested remaining-move count. This exercises
     * the SAME reward formula (10 + moveBudget - movesUsed) the real DUEL
     * settlement path uses (see PveChallengeService#onEncounterCleared),
     * just without needing to actually play out a full duel to a specific
     * move count.
     */
    @Given("^玩家 \"([^\"]*)\" 於第(\\d+)關魔王對弈剩餘手數為 (\\d+) 時通過$")
    public void clearsDuelEncounterWithRemaining(String user, int sequence, int remaining) {
        support.jumpToEncounter(sequence);
        PveEncounter encounter = support.encounter();
        int budget = encounter.getMoveBudget();
        Assertions.assertThat(remaining)
                .as("requested remaining=%d must be reachable within this level's real budget=%d", remaining, budget)
                .isLessThanOrEqualTo(budget);
        encounter.setMovesUsed(budget - remaining);
        support.encounters().save(encounter);
        support.forceWinCurrentDuelEncounter();
        Assertions.assertThat(support.encounter().getStatus().name()).isEqualTo("CLEARED");
    }

    @When("系統結算通關獎勵")
    public void settleClearReward() {
        // Awarded synchronously inside the clear settlement — nothing to do.
    }

    @Then("^玩家獲得金幣 (\\d+)（.*）$")
    public void playerGainsGold(int gold) {
        Assertions.assertThat(support.run().getGold()).isEqualTo(gold);
    }

    @Then("系統發布 GoldAwarded 事件")
    public void goldAwardedPublished() {
        Assertions.assertThat(support.run().getGoldEarned()).isGreaterThan(0);
    }

    // ────────────────────────── shop opening ─────────────────────────────────

    @Given("玩家 {string} 通過第{int}關")
    public void playerClearsEncounter(String user, int sequence) {
        // Climbing several real PUZZLE levels' own designed solutions in one
        // un-retried random-seed run compounds each level's own small chance
        // of a rare RNG-driven edge case (RAGE/minor-disruption timing) ending
        // an encounter FAILED instead of CLEARED — exactly the class of case
        // 關卡可解性.feature grants itself MAX_SEED_ATTEMPTS retries for. A
        // FAILED encounter also terminates the whole run (FR-C7), so there is
        // nothing to salvage from the current run — retry the WHOLE climb
        // with a fresh run (new random seed) instead of just the failed step.
        String classType = support.run().getClassType().name();
        AssertionError last = null;
        for (int attempt = 0; attempt < 20; attempt++) {
            try {
                support.advanceToEncounter(user, sequence);
                support.clearCurrentEncounterCheaply(user);
                return;
            } catch (AssertionError e) {
                last = e;
                support.startRun(user, classType);
            }
        }
        throw new AssertionError("could not clear through sequence " + sequence
                + " within 20 fresh-run attempts", last);
    }

    @When("系統推進至商店階段")
    public void advanceToShopPhase() {
        // The shop visit opens synchronously on clear.
    }

    @Then("系統開啟商店，展示遺物x2與技能x1")
    @SuppressWarnings("unchecked")
    public void shopOpensWithFixedSlots() {
        Map<String, Object> shop = getShop(support.user());
        Assertions.assertThat(shop).isNotNull();
        List<Map<String, Object>> offers = (List<Map<String, Object>>) shop.get("offers");
        Assertions.assertThat(offers).hasSize(3);
        Assertions.assertThat(offers.stream().filter(o -> "RELIC".equals(o.get("offerKind"))).count())
                .isEqualTo(2);
        Assertions.assertThat(offers.stream().filter(o -> "SKILL".equals(o.get("offerKind"))).count())
                .isEqualTo(1);
    }

    @Then("系統發布 PveShopOpened 事件")
    public void shopOpenedPublished() {
        Assertions.assertThat(openVisit()).isNotNull();
    }

    @Then("系統不開啟商店，直接進行Run結算")
    public void noShopAfterEighth() {
        Assertions.assertThat(support.shopVisits()
                        .findByRunIdAndAfterEncounterSequenceAndDeletedFalse(support.runId(), 8))
                .isEmpty();
        Assertions.assertThat(support.run().getStatus()).isEqualTo(PveRunStatus.WON);
    }

    // ────────────────────────── offer pools ──────────────────────────────────

    @Given("玩家 {string} 職業為 {string}")
    public void playerClassIs(String user, String classType) {
        Assertions.assertThat(support.run().getClassType().name()).isEqualTo(classType);
    }

    @When("系統開啟商店")
    public void openShop() {
        support.ensureShopOpen(support.user());
    }

    @Then("技能展示位僅可能為 {string}、{string} 或 {string} 之一")
    @SuppressWarnings("unchecked")
    public void skillSlotFromClassPool(String a, String b, String c) {
        Map<String, Object> shop = getShop(support.user());
        Map<String, Object> skillSlot = ((List<Map<String, Object>>) shop.get("offers")).stream()
                .filter(o -> "SKILL".equals(o.get("offerKind")))
                .findFirst().orElseThrow();
        Assertions.assertThat((String) skillSlot.get("skillType")).isIn(a, b, c);
    }

    @Given("玩家 {string} 已持有遺物 {string}")
    public void alreadyHoldsRelic(String user, String relicType) {
        support.grantRelic(PveRelicType.valueOf(relicType));
    }

    @Then("展示位中不含 {string}")
    @SuppressWarnings("unchecked")
    public void offersExcludeRelic(String relicType) {
        Map<String, Object> shop = getShop(support.user());
        List<Map<String, Object>> offers = (List<Map<String, Object>>) shop.get("offers");
        Assertions.assertThat(offers.stream().anyMatch(o -> relicType.equals(o.get("relicType"))))
                .isFalse();
    }

    // ────────────────────────── holding caps ─────────────────────────────────

    @Given("玩家 {string} 已持有5件遺物")
    public void holdsFiveRelics(String user) {
        support.grantRelic(PveRelicType.METRONOME);
        support.grantRelic(PveRelicType.RECYCLER);
        support.grantRelic(PveRelicType.GEMINI_STAR);
        support.grantRelic(PveRelicType.VOLCANO_HEART);
        support.grantRelic(PveRelicType.TIDE_BREAKWATER);
    }

    @When("玩家 {string} 嘗試購買展示位中的遺物")
    public void attemptPurchaseRelicSlot(String user) {
        support.ensureShopOpen(user);
        setGold(100);
        // 2026-07-10 測試缺口修補：A2修正後（遺物滿5件時 drawer 直接不抽任何
        // 遺物槽），正常抽選永遠碰不到「對遺物槽出手但已達上限」——本步驟原本
        // 買到的其實是被 drawer 轉成技能的槽位，購買會成功（200），斷言的
        // 「遺物持有已達上限」守門從未被行使。但真實流程仍可能觸及該守門：
        // 持有4件時商店抽出2個遺物槽，買下第1個（達5件）後再買第2個。此處
        // 直接把槽位改回 RELIC 商品重現該狀態，驗證 service 層的 RELIC_CAP
        // 守門（PveShopService.purchase）——與本檔既有 setGold/setMoveBudget
        // 同款 fixture 手法。
        forceSlotOffer(0, PveShopOfferKind.RELIC, PveRelicType.SHARP_BLADE, null);
        purchase(user, 0);
    }

    // A2修正（2026-07-08調校輪）：遺物達上限時，兩個relic槽位改抽技能，三個
    // 展示位全數變成技能——見PveShopOfferDrawer.drawSlots的class javadoc。
    @Then("三個展示位皆為技能，不含任何遺物")
    @SuppressWarnings("unchecked")
    public void allSlotsAreSkillNoRelic() {
        Map<String, Object> shop = getShop(support.user());
        List<Map<String, Object>> offers = (List<Map<String, Object>>) shop.get("offers");
        Assertions.assertThat(offers).hasSize(3);
        Assertions.assertThat(offers).allMatch(o -> "SKILL".equals(o.get("offerKind")));
    }

    // A2修正：技能達上限時，原本的技能槽位改抽第3件遺物，三個展示位全數變成
    // 遺物（前提：未持有的遺物池仍有>=3種可抽——預設8種遺物、目前僅持有0件時
    // 恆滿足）。
    @Then("三個展示位皆為遺物，不含任何技能")
    @SuppressWarnings("unchecked")
    public void allSlotsAreRelicNoSkill() {
        Map<String, Object> shop = getShop(support.user());
        List<Map<String, Object>> offers = (List<Map<String, Object>>) shop.get("offers");
        Assertions.assertThat(offers).hasSize(3);
        Assertions.assertThat(offers).allMatch(o -> "RELIC".equals(o.get("offerKind")));
    }

    @Given("玩家 {string} 已持有技能總數量達3")
    public void holdsThreeSkillsTotal(String user) {
        support.grantSkill(SkillType.HORIZONTAL_SLASH, 3);
    }

    @When("玩家 {string} 嘗試購買展示位中的技能")
    public void attemptPurchaseSkillSlot(String user) {
        support.ensureShopOpen(user);
        setGold(100);
        // 2026-07-10 測試缺口修補：同上（attemptPurchaseRelicSlot）——技能滿3
        // 時 drawer 會把技能槽轉成遺物，原本此步驟買到的是遺物、購買成功，
        // 「技能持有已達上限」守門從未被行使。強制槽位為 SKILL 商品以行使
        // service 層 SKILL_CAP 守門。
        forceSlotOffer(2, PveShopOfferKind.SKILL, null, SkillType.HORIZONTAL_SLASH);
        purchase(user, 2);
    }

    // ────────────────────────── duplicate skill purchase ─────────────────────

    @Given("玩家 {string} 已持有技能 {string} 數量 {int}")
    public void alreadyHoldsSkillQuantity(String user, String skillType, int quantity) {
        support.grantSkill(SkillType.valueOf(skillType), quantity);
    }

    @When("玩家 {string} 花費6金幣再次購買 {string}")
    public void purchaseSameSkillAgain(String user, String skillType) {
        support.ensureShopOpen(user);
        // Pin the skill slot to the wanted skill (draws are random within the
        // class pool; the rule under test is duplicate holding, not the draw).
        PveShopVisit visit = openVisit();
        PveShopOfferSlot slot = slotRepository
                .findByShopVisitIdAndSlotIndexAndDeletedFalse(visit.getId(), 2)
                .orElseThrow();
        slot.setSkillType(SkillType.valueOf(skillType));
        slot.setPrice(6);
        slot.setPurchased(false);
        slotRepository.save(slot);
        setGold(50);
        ctx.putMemo("pve:goldBefore", 50);
        purchase(user, 2);
    }

    @Then("玩家 {string} 持有技能 {string} 數量為 {int}")
    public void holdsSkillQuantity(String user, String skillType, int quantity) {
        Assertions.assertThat(support.skillQuantity(SkillType.valueOf(skillType))).isEqualTo(quantity);
    }

    @Then("系統發布 PveShopOfferPurchased 事件")
    public void purchasedPublished() {
        int before = (int) ctx.getMemo("pve:goldBefore");
        Assertions.assertThat(support.run().getGold()).isEqualTo(before - 6);
        PveShopVisit visit = openVisit();
        Assertions.assertThat(slotRepository
                        .findByShopVisitIdAndSlotIndexAndDeletedFalse(visit.getId(), 2)
                        .orElseThrow()
                        .isPurchased())
                .isTrue();
    }

    // ────────────────────────── reroll ───────────────────────────────────────

    @Given("玩家 {string} 金幣為{int}")
    public void playerGoldIs(String user, int gold) {
        support.ensureShopOpen(user);
        setGold(gold);
    }

    @When("玩家 {string} 重抽商店")
    public void rerollShop(String user) {
        reroll(user);
    }

    @When("玩家 {string} 嘗試重抽商店")
    public void attemptRerollShop(String user) {
        reroll(user);
    }

    @Then("^玩家花費(\\d+)金幣，剩餘金幣為(\\d+)$")
    public void spentAndRemainingGold(int spent, int remaining) {
        Assertions.assertThat(support.run().getGold()).isEqualTo(remaining);
    }

    @Then("三個展示位全部更新為新內容")
    @SuppressWarnings("unchecked")
    public void allSlotsRedrawn() {
        Map<String, Object> shop = getShop(support.user());
        List<Map<String, Object>> offers = (List<Map<String, Object>>) shop.get("offers");
        Assertions.assertThat(offers).hasSize(3);
        offers.forEach(o -> Assertions.assertThat((Boolean) o.get("purchased")).isFalse());
        Assertions.assertThat(((Number) shop.get("rerollCount")).intValue()).isGreaterThanOrEqualTo(1);
    }

    @Then("系統發布 PveShopRerolled 事件")
    public void rerolledPublished() {
        Assertions.assertThat(openVisit().getRerollCount()).isGreaterThanOrEqualTo(1);
    }

    // ────────────────────────── skip ─────────────────────────────────────────

    @When("玩家 {string} 跳過商店")
    public void skipShop(String user) {
        support.ensureShopOpen(user);
        ctx.putMemo("pve:goldBefore", support.run().getGold());
        ctx.putMemo("pve:skippedVisitSeq", openVisit().getAfterEncounterSequence());
        support.skipShopApi(user);
    }

    @Then("系統不扣除金幣")
    public void goldUnchanged() {
        Assertions.assertThat(support.run().getGold()).isEqualTo(ctx.getMemo("pve:goldBefore"));
    }

    @Then("系統建立下一關並發布 PveShopSkipped 事件")
    public void nextEncounterCreatedAndSkipped() {
        int skippedSeq = (int) ctx.getMemo("pve:skippedVisitSeq");
        PveRun run = support.run();
        Assertions.assertThat(run.getCurrentEncounterSequence()).isEqualTo(skippedSeq + 1);
        PveEncounter next = support.encounters()
                .findByRunIdAndSequenceAndDeletedFalse(run.getId(), skippedSeq + 1)
                .orElseThrow();
        Assertions.assertThat(next.getStatus().name()).isEqualTo("IN_PROGRESS");
        PveShopVisit visit = support.shopVisits()
                .findByRunIdAndAfterEncounterSequenceAndDeletedFalse(run.getId(), skippedSeq)
                .orElseThrow();
        Assertions.assertThat(visit.getStatus()).isEqualTo(PveShopVisitStatus.CLOSED);
    }

    // ────────────────────────── helpers ──────────────────────────────────────

    private void setGold(int gold) {
        PveRun run = support.run();
        run.setGold(gold);
        support.runs().save(run);
    }

    private PveShopVisit openVisit() {
        return support.shopVisits()
                .findFirstByRunIdAndStatusAndDeletedFalseOrderByAfterEncounterSequenceDesc(
                        support.runId(), PveShopVisitStatus.OPEN)
                .orElse(null);
    }

    /** 直接改寫已抽出的展示位商品（見 attemptPurchaseRelicSlot 註解——重現
     * drawer 的滿載轉抽規則遮蔽不到、但真實流程仍可觸及的「對已達上限的商品
     * 種類出手」狀態，行使 service 層守門）。 */
    private void forceSlotOffer(int slotIndex, PveShopOfferKind kind, PveRelicType relicType, SkillType skillType) {
        PveShopVisit visit = openVisit();
        Assertions.assertThat(visit).as("an OPEN shop visit must exist").isNotNull();
        PveShopOfferSlot slot = slotRepository
                .findByShopVisitIdAndSlotIndexAndDeletedFalse(visit.getId(), slotIndex)
                .orElseThrow();
        slot.setOfferKind(kind);
        slot.setRelicType(relicType);
        slot.setSkillType(skillType);
        slotRepository.save(slot);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getShop(String user) {
        ResponseEntity<Map> resp = support.rest().exchange(
                "/api/gmk/v1/pve/runs/" + support.runId() + "/shop",
                HttpMethod.GET,
                new HttpEntity<>(support.common().authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        return resp.getBody() == null ? null : (Map<String, Object>) resp.getBody().get("data");
    }

    @SuppressWarnings("unchecked")
    private void purchase(String user, int slotIndex) {
        ResponseEntity<Map> resp = support.rest().postForEntity(
                "/api/gmk/v1/pve/runs/" + support.runId() + "/shop/actions/purchase",
                new HttpEntity<>(String.format("{\"slotIndex\":%d}", slotIndex),
                        support.common().authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
    }

    @SuppressWarnings("unchecked")
    private void reroll(String user) {
        ResponseEntity<Map> resp = support.rest().postForEntity(
                "/api/gmk/v1/pve/runs/" + support.runId() + "/shop/actions/reroll",
                new HttpEntity<>("{}", support.common().authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
    }
}
