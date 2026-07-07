package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.entity.PveShopOfferSlot;
import com.gomoku.domain.entity.PveShopVisit;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.PveRunStatus;
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
        int needed = support.encounter().getMoveBudget() - remaining;
        Assertions.assertThat(needed).isGreaterThanOrEqualTo(5);
        support.setBossHp(50);
        support.placeFillers(user, needed - 5);
        support.playCleanVerticalLine(user);
        Assertions.assertThat(support.encounter().getStatus().name()).isEqualTo("CLEARED");
        Assertions.assertThat(support.encounter().getMovesUsed())
                .isEqualTo(support.encounter().getMoveBudget() - remaining);
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
        support.advanceToEncounter(user, sequence);
        support.clearCurrentEncounterCheaply(user);
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
        purchase(user, 0);
    }

    @Given("玩家 {string} 已持有技能總數量達3")
    public void holdsThreeSkillsTotal(String user) {
        support.grantSkill(SkillType.HORIZONTAL_SLASH, 3);
    }

    @When("玩家 {string} 嘗試購買展示位中的技能")
    public void attemptPurchaseSkillSlot(String user) {
        support.ensureShopOpen(user);
        setGold(100);
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
