package com.gomoku.service;

import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.entity.PveRunRelic;
import com.gomoku.domain.entity.PveRunSkill;
import com.gomoku.domain.entity.PveShopOfferSlot;
import com.gomoku.domain.entity.PveShopVisit;
import com.gomoku.domain.enums.PveRunStatus;
import com.gomoku.domain.enums.PveShopOfferKind;
import com.gomoku.domain.enums.PveShopVisitStatus;
import com.gomoku.dto.response.PveShopStateResponse;
import com.gomoku.exception.BusinessException;
import com.gomoku.exception.ErrorCode;
import com.gomoku.repository.PveRunRelicRepository;
import com.gomoku.repository.PveRunRepository;
import com.gomoku.repository.PveRunSkillRepository;
import com.gomoku.repository.PveShopOfferSlotRepository;
import com.gomoku.repository.PveShopVisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Shop actions (FR-C4): purchase by slot, unlimited 5-gold rerolls, skip to
 * the next encounter. Holding caps: relics 5 (unique), skills 3 (total
 * quantity, duplicates allowed).
 */
@Service
public class PveShopService {

    public static final int RELIC_CAP = 5;
    public static final int SKILL_CAP = 3;

    private final PveShopVisitRepository visitRepository;
    private final PveShopOfferSlotRepository slotRepository;
    private final PveRunRepository runRepository;
    private final PveRunSkillRepository skillRepository;
    private final PveRunRelicRepository relicRepository;
    private final PveShopOfferDrawer offerDrawer;
    private final PveChallengeService challengeService;

    public PveShopService(PveShopVisitRepository visitRepository,
                          PveShopOfferSlotRepository slotRepository,
                          PveRunRepository runRepository,
                          PveRunSkillRepository skillRepository,
                          PveRunRelicRepository relicRepository,
                          PveShopOfferDrawer offerDrawer,
                          PveChallengeService challengeService) {
        this.visitRepository = visitRepository;
        this.slotRepository = slotRepository;
        this.runRepository = runRepository;
        this.skillRepository = skillRepository;
        this.relicRepository = relicRepository;
        this.offerDrawer = offerDrawer;
        this.challengeService = challengeService;
    }

    @Transactional(readOnly = true)
    public PveShopStateResponse getShop(String playerId, String runId) {
        PveRun run = challengeService.requireOwnedRun(playerId, runId);
        PveShopVisit visit = requireOpenVisit(run);
        return buildShopState(run, visit);
    }

    @Transactional
    public PveShopStateResponse purchase(String playerId, String runId, int slotIndex) {
        PveRun run = challengeService.requireOwnedRun(playerId, runId);
        PveShopVisit visit = requireOpenVisit(run);
        PveShopOfferSlot slot = slotRepository
                .findByShopVisitIdAndSlotIndexAndDeletedFalse(visit.getId(), slotIndex)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "展示位不存在"));
        if (slot.isPurchased()) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "該展示位已售出");
        }

        if (slot.getOfferKind() == PveShopOfferKind.RELIC) {
            if (slot.getRelicType() == null) {
                throw new BusinessException(ErrorCode.UNPROCESSABLE, "該展示位無商品");
            }
            if (relicRepository.findByRunIdAndDeletedFalse(run.getId()).size() >= RELIC_CAP) {
                throw new BusinessException(ErrorCode.UNPROCESSABLE, "遺物持有已達上限");
            }
        } else {
            int totalSkills = skillRepository.findByRunIdAndDeletedFalse(run.getId()).stream()
                    .mapToInt(PveRunSkill::getQuantity)
                    .sum();
            if (totalSkills >= SKILL_CAP) {
                throw new BusinessException(ErrorCode.UNPROCESSABLE, "技能持有已達上限");
            }
        }

        if (run.getGold() < slot.getPrice()) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "金幣不足");
        }
        run.setGold(run.getGold() - slot.getPrice());
        run.setGoldSpent(run.getGoldSpent() + slot.getPrice());

        if (slot.getOfferKind() == PveShopOfferKind.RELIC) {
            PveRunRelic relic = new PveRunRelic();
            relic.setRunId(run.getId());
            relic.setRelicType(slot.getRelicType());
            relic.setAcquiredAt(Instant.now());
            relicRepository.save(relic);
        } else {
            PveRunSkill held = skillRepository
                    .findByRunIdAndSkillTypeAndDeletedFalse(run.getId(), slot.getSkillType())
                    .orElseGet(() -> {
                        PveRunSkill sk = new PveRunSkill();
                        sk.setRunId(run.getId());
                        sk.setSkillType(slot.getSkillType());
                        sk.setQuantity(0);
                        return sk;
                    });
            held.setQuantity(held.getQuantity() + 1);
            skillRepository.save(held);
        }

        slot.setPurchased(true);
        slotRepository.save(slot);
        runRepository.save(run);
        return buildShopState(run, visit);
    }

    @Transactional
    public PveShopStateResponse reroll(String playerId, String runId) {
        PveRun run = challengeService.requireOwnedRun(playerId, runId);
        PveShopVisit visit = requireOpenVisit(run);
        if (run.getGold() < PveShopOfferDrawer.REROLL_PRICE) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "金幣不足");
        }
        run.setGold(run.getGold() - PveShopOfferDrawer.REROLL_PRICE);
        run.setGoldSpent(run.getGoldSpent() + PveShopOfferDrawer.REROLL_PRICE);
        visit.setRerollCount(visit.getRerollCount() + 1);
        offerDrawer.drawSlots(run, visit, false);
        visitRepository.save(visit);
        runRepository.save(run);
        return buildShopState(run, visit);
    }

    /**
     * Close the shop and advance to the next encounter (FR-C4); returns the
     * next PveEncounterStateResponse. (No shop exists after the 8th clear, so
     * a skip always has a next encounter.)
     */
    @Transactional
    public Object skip(String playerId, String runId) {
        PveRun run = challengeService.requireOwnedRun(playerId, runId);
        PveShopVisit visit = requireOpenVisit(run);
        visit.setStatus(PveShopVisitStatus.CLOSED);
        visit.setClosedAt(Instant.now());
        visitRepository.save(visit);

        if (run.getStatus() != PveRunStatus.IN_PROGRESS) {
            return challengeService.buildRunResult(run);
        }
        int nextSequence = visit.getAfterEncounterSequence() + 1;
        run.setCurrentEncounterSequence(nextSequence);
        runRepository.save(run);
        PveEncounter next = challengeService.createEncounter(run, nextSequence);
        return challengeService.buildEncounterState(next, null, List.of());
    }

    private PveShopVisit requireOpenVisit(PveRun run) {
        return visitRepository
                .findFirstByRunIdAndStatusAndDeletedFalseOrderByAfterEncounterSequenceDesc(
                        run.getId(), PveShopVisitStatus.OPEN)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "目前無開啟中的商店"));
    }

    private PveShopStateResponse buildShopState(PveRun run, PveShopVisit visit) {
        List<PveShopStateResponse.OfferItem> offers = slotRepository
                .findByShopVisitIdAndDeletedFalseOrderBySlotIndexAsc(visit.getId()).stream()
                .map(slot -> new PveShopStateResponse.OfferItem(
                        slot.getSlotIndex(),
                        slot.getOfferKind().name(),
                        slot.getRelicType() == null ? null : slot.getRelicType().name(),
                        slot.getSkillType() == null ? null : slot.getSkillType().name(),
                        slot.getPrice(),
                        slot.isPurchased()))
                .toList();
        return new PveShopStateResponse(
                visit.getId(),
                run.getId(),
                visit.getAfterEncounterSequence(),
                visit.getStatus().name(),
                visit.getRerollCount(),
                run.getGold(),
                offers);
    }
}
