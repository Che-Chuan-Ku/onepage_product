package com.gomoku.service;

import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.entity.PveRunRelic;
import com.gomoku.domain.entity.PveRunSkill;
import com.gomoku.domain.entity.PveShopOfferSlot;
import com.gomoku.domain.entity.PveShopVisit;
import com.gomoku.domain.enums.ClassType;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.PveShopOfferKind;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.game.PveRandoms;
import com.gomoku.repository.PveRunRelicRepository;
import com.gomoku.repository.PveRunSkillRepository;
import com.gomoku.repository.PveShopOfferSlotRepository;
import com.gomoku.repository.PveShopVisitRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Opens shop visits and (re)draws the fixed 3 display slots (FR-C4). Held
 * relics are never drawn; draws are seed-deterministic per (sequence,
 * rerollCount) (FR-A3). Skill price fixed at 6; relic prices from
 * PveRelicType.
 *
 * A2 修正（PVE-八關評論彙編與迭代清單-2026-07-08.md）：原本固定「relic x2 +
 * skill x1」，一旦該類別（relic 5件 / skill 3件）已達持有上限，那個固定槽位
 * 仍會抽出同類商品，只是永遠買不起（後端422、前端灰掉）——形同白佔一個展示
 * 位的「廢卡」。改為：技能已達上限時，該槽位改抽一件遺物（3 relic + 0
 * skill，前提是遺物池還有>=3種未持有可抽）；遺物已達上限（且技能未達上限）
 * 時，兩個relic槽位改抽技能（0 relic + 3 skill）。兩類同時達上限（此後再無
 * 任何可購商品）是唯二保留舊行為（該槽維持原類別但不可購買）的情形——這種情況
 * 下沒有任何替代品可補，属於遊戲後期正常的「全部收藏完畢」狀態，非bug。
 */
@Component
public class PveShopOfferDrawer {

    public static final int SKILL_PRICE = 6;
    public static final int REROLL_PRICE = 5;

    private final PveShopVisitRepository visitRepository;
    private final PveShopOfferSlotRepository slotRepository;
    private final PveRunRelicRepository relicRepository;
    private final PveRunSkillRepository skillRepository;

    public PveShopOfferDrawer(PveShopVisitRepository visitRepository,
                              PveShopOfferSlotRepository slotRepository,
                              PveRunRelicRepository relicRepository,
                              PveRunSkillRepository skillRepository) {
        this.visitRepository = visitRepository;
        this.slotRepository = slotRepository;
        this.relicRepository = relicRepository;
        this.skillRepository = skillRepository;
    }

    /** Open the shop after clearing {@code afterSequence} (never after the 8th). */
    public PveShopVisit openShop(PveRun run, int afterSequence) {
        PveShopVisit visit = new PveShopVisit();
        visit.setRunId(run.getId());
        visit.setAfterEncounterSequence(afterSequence);
        visit.setOpenedAt(Instant.now());
        visitRepository.save(visit);
        drawSlots(run, visit, true);
        return visit;
    }

    /** (Re)draw all three slots; on reroll existing slot rows are overwritten. */
    public void drawSlots(PveRun run, PveShopVisit visit, boolean initial) {
        Random rng = PveRandoms.forPurpose(run.getSeed(),
                "shop:" + visit.getAfterEncounterSequence() + ":" + visit.getRerollCount());

        List<PveRelicType> pool = new ArrayList<>();
        List<PveRelicType> held = relicRepository.findByRunIdAndDeletedFalse(run.getId()).stream()
                .map(PveRunRelic::getRelicType)
                .toList();
        for (PveRelicType relic : PveRelicType.values()) {
            if (!held.contains(relic)) {
                pool.add(relic);
            }
        }
        Collections.shuffle(pool, rng);

        List<SkillType> classPool = skillPoolFor(run.getClassType());

        // A2 修正：把「固定relic x2 + skill x1」改成依持有上限動態決定relic/skill
        // 槽位數，避免已達上限的類別繼續佔用展示位（見class javadoc）。
        int totalSkillQty = skillRepository.findByRunIdAndDeletedFalse(run.getId()).stream()
                .mapToInt(PveRunSkill::getQuantity)
                .sum();
        boolean skillCapped = totalSkillQty >= PveShopService.SKILL_CAP;
        boolean relicCapped = held.size() >= PveShopService.RELIC_CAP;

        int relicSlots = 2;
        if (skillCapped && !relicCapped && pool.size() >= 3) {
            relicSlots = 3; // skill槽位改抽第3件遺物（不再佔位賣不出去的技能）
        } else if (relicCapped && !skillCapped) {
            relicSlots = 0; // 兩個relic槽位改抽技能
        }

        for (int slotIndex = 0; slotIndex < 3; slotIndex++) {
            PveShopOfferSlot slot = initial
                    ? new PveShopOfferSlot()
                    : slotRepository.findByShopVisitIdAndSlotIndexAndDeletedFalse(visit.getId(), slotIndex)
                            .orElseGet(PveShopOfferSlot::new);
            slot.setShopVisitId(visit.getId());
            slot.setSlotIndex(slotIndex);
            slot.setPurchased(false);
            if (slotIndex < relicSlots) {
                PveRelicType relic = slotIndex < pool.size() ? pool.get(slotIndex) : null;
                slot.setOfferKind(PveShopOfferKind.RELIC);
                slot.setRelicType(relic);
                slot.setSkillType(null);
                slot.setPrice(relic == null ? 0 : relic.getPrice());
            } else {
                SkillType skill = classPool.get(rng.nextInt(classPool.size()));
                slot.setOfferKind(PveShopOfferKind.SKILL);
                slot.setSkillType(skill);
                slot.setRelicType(null);
                slot.setPrice(SKILL_PRICE);
            }
            slotRepository.save(slot);
        }
    }

    /** The 3-skill pool of a class (FR-C4). */
    public static List<SkillType> skillPoolFor(ClassType classType) {
        return classType == ClassType.WARRIOR
                ? List.of(SkillType.HORIZONTAL_SLASH, SkillType.VERTICAL_SLASH, SkillType.HEAVEN_EARTH_REVERSAL)
                : List.of(SkillType.PRECISION_SNIPE, SkillType.SCATTER_SHOT, SkillType.PIONEER_STAR);
    }
}
