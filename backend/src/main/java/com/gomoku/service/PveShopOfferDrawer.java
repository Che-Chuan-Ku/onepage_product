package com.gomoku.service;

import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.entity.PveRunRelic;
import com.gomoku.domain.entity.PveShopOfferSlot;
import com.gomoku.domain.entity.PveShopVisit;
import com.gomoku.domain.enums.ClassType;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.PveShopOfferKind;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.game.PveRandoms;
import com.gomoku.repository.PveRunRelicRepository;
import com.gomoku.repository.PveShopOfferSlotRepository;
import com.gomoku.repository.PveShopVisitRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Opens shop visits and (re)draws the fixed 3 display slots — relic x2 +
 * one skill from the player's 3-skill class pool (FR-C4). Held relics are
 * never drawn; draws are seed-deterministic per (sequence, rerollCount)
 * (FR-A3). Skill price fixed at 6; relic prices from PveRelicType.
 */
@Component
public class PveShopOfferDrawer {

    public static final int SKILL_PRICE = 6;
    public static final int REROLL_PRICE = 5;

    private final PveShopVisitRepository visitRepository;
    private final PveShopOfferSlotRepository slotRepository;
    private final PveRunRelicRepository relicRepository;

    public PveShopOfferDrawer(PveShopVisitRepository visitRepository,
                              PveShopOfferSlotRepository slotRepository,
                              PveRunRelicRepository relicRepository) {
        this.visitRepository = visitRepository;
        this.slotRepository = slotRepository;
        this.relicRepository = relicRepository;
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
        SkillType skill = classPool.get(rng.nextInt(classPool.size()));

        for (int slotIndex = 0; slotIndex < 3; slotIndex++) {
            PveShopOfferSlot slot = initial
                    ? new PveShopOfferSlot()
                    : slotRepository.findByShopVisitIdAndSlotIndexAndDeletedFalse(visit.getId(), slotIndex)
                            .orElseGet(PveShopOfferSlot::new);
            slot.setShopVisitId(visit.getId());
            slot.setSlotIndex(slotIndex);
            slot.setPurchased(false);
            if (slotIndex < 2) {
                PveRelicType relic = slotIndex < pool.size() ? pool.get(slotIndex) : null;
                slot.setOfferKind(PveShopOfferKind.RELIC);
                slot.setRelicType(relic);
                slot.setSkillType(null);
                slot.setPrice(relic == null ? 0 : relic.getPrice());
            } else {
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
