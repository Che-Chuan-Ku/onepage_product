package com.gomoku.controller;

import com.gomoku.dto.request.PveMoveCreateRequest;
import com.gomoku.dto.request.PveRunCreateRequest;
import com.gomoku.dto.request.PveSkillUseRequest;
import com.gomoku.dto.response.PveEncounterStateResponse;
import com.gomoku.dto.response.PveRunResultResponse;
import com.gomoku.dto.response.PveRunStateResponse;
import com.gomoku.dto.response.PveShopStateResponse;
import com.gomoku.security.CurrentUser;
import com.gomoku.service.PveChallengeService;
import com.gomoku.service.PveShopService;
import com.gomoku.web.ManageResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * PVE challenge endpoints (api.yml pve tag):
 *   createPveRun, getCurrentPveRun, abandonPveRun, getPveEncounter,
 *   placePveMove, usePveSkill, getPveShop, purchasePveShopOffer,
 *   rerollPveShop, skipPveShop.
 * Base path: /api/gmk/v1/pve — all endpoints require a logged-in player.
 *   getPveRunResult — GET /pve/runs/{runId}/result (FR-C7).
 */
@RestController
@RequestMapping("/api/gmk/v1/pve")
public class PveController {

    private final PveChallengeService challengeService;
    private final PveShopService shopService;
    private final CurrentUser currentUser;

    public PveController(PveChallengeService challengeService,
                         PveShopService shopService,
                         CurrentUser currentUser) {
        this.challengeService = challengeService;
        this.shopService = shopService;
        this.currentUser = currentUser;
    }

    /** POST /pve/runs — operationId: createPveRun (FR-B1 FR-C8). */
    @PostMapping("/runs")
    public ResponseEntity<ManageResponse<PveRunStateResponse>> createPveRun(
            @Valid @RequestBody PveRunCreateRequest req) {
        PveRunStateResponse data = challengeService.createRun(currentUser.requireId(), req);
        return ResponseEntity.status(201).body(ManageResponse.created(data));
    }

    /** GET /pve/runs/current — operationId: getCurrentPveRun (FR-B6 FR-C8). */
    @GetMapping("/runs/current")
    public ResponseEntity<ManageResponse<PveRunStateResponse>> getCurrentPveRun() {
        PveRunStateResponse data = challengeService.getCurrentRun(currentUser.requireId());
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /** POST /pve/runs/{runId}/actions/abandon — operationId: abandonPveRun (FR-C7). */
    @PostMapping("/runs/{runId}/actions/abandon")
    public ResponseEntity<ManageResponse<PveRunResultResponse>> abandonPveRun(
            @PathVariable String runId) {
        PveRunResultResponse data = challengeService.abandonRun(currentUser.requireId(), runId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /** GET /pve/runs/{runId}/result — operationId: getPveRunResult (FR-C7). */
    @GetMapping("/runs/{runId}/result")
    public ResponseEntity<ManageResponse<PveRunResultResponse>> getPveRunResult(
            @PathVariable String runId) {
        PveRunResultResponse data = challengeService.getRunResult(currentUser.requireId(), runId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /** GET /pve/encounters/{encounterId} — operationId: getPveEncounter (FR-B6). */
    @GetMapping("/encounters/{encounterId}")
    public ResponseEntity<ManageResponse<PveEncounterStateResponse>> getPveEncounter(
            @PathVariable String encounterId) {
        PveEncounterStateResponse data = challengeService.getEncounter(currentUser.requireId(), encounterId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /** POST /pve/encounters/{encounterId}/moves — operationId: placePveMove (FR-B2/B3/B4). */
    @PostMapping("/encounters/{encounterId}/moves")
    public ResponseEntity<ManageResponse<PveEncounterStateResponse>> placePveMove(
            @PathVariable String encounterId,
            @Valid @RequestBody PveMoveCreateRequest req) {
        PveEncounterStateResponse data = challengeService.placeMove(currentUser.requireId(), encounterId, req);
        return ResponseEntity.status(201).body(ManageResponse.created(data));
    }

    /** POST /pve/encounters/{encounterId}/actions/use-skill — operationId: usePveSkill (FR-B5). */
    @PostMapping("/encounters/{encounterId}/actions/use-skill")
    public ResponseEntity<ManageResponse<PveEncounterStateResponse>> usePveSkill(
            @PathVariable String encounterId,
            @Valid @RequestBody PveSkillUseRequest req) {
        PveEncounterStateResponse data = challengeService.useSkill(currentUser.requireId(), encounterId, req);
        return ResponseEntity.status(201).body(ManageResponse.created(data));
    }

    /**
     * POST /pve/encounters/{encounterId}/actions/retry — operationId:
     * retryPveEncounter (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §1.5/§6.5).
     * DUEL-only, DRAW-status-only: reopens the SAME sequence with a fresh
     * board and boss-AI RNG stream, without forfeiting the run (unlimited
     * retries).
     */
    @PostMapping("/encounters/{encounterId}/actions/retry")
    public ResponseEntity<ManageResponse<PveEncounterStateResponse>> retryPveEncounter(
            @PathVariable String encounterId) {
        PveEncounterStateResponse data = challengeService.retryDuelEncounter(currentUser.requireId(), encounterId);
        return ResponseEntity.status(201).body(ManageResponse.created(data));
    }

    /** GET /pve/runs/{runId}/shop — operationId: getPveShop (FR-C4). */
    @GetMapping("/runs/{runId}/shop")
    public ResponseEntity<ManageResponse<PveShopStateResponse>> getPveShop(
            @PathVariable String runId) {
        PveShopStateResponse data = shopService.getShop(currentUser.requireId(), runId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /** POST /pve/runs/{runId}/shop/actions/purchase — operationId: purchasePveShopOffer. */
    @PostMapping("/runs/{runId}/shop/actions/purchase")
    public ResponseEntity<ManageResponse<PveShopStateResponse>> purchasePveShopOffer(
            @PathVariable String runId,
            @Valid @RequestBody PveShopPurchaseRequest req) {
        PveShopStateResponse data = shopService.purchase(currentUser.requireId(), runId, req.slotIndex());
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /** POST /pve/runs/{runId}/shop/actions/reroll — operationId: rerollPveShop. */
    @PostMapping("/runs/{runId}/shop/actions/reroll")
    public ResponseEntity<ManageResponse<PveShopStateResponse>> rerollPveShop(
            @PathVariable String runId) {
        PveShopStateResponse data = shopService.reroll(currentUser.requireId(), runId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /pve/runs/{runId}/shop/actions/skip — operationId: skipPveShop.
     * data = next PveEncounterStateResponse, or PveRunResultResponse when the
     * run has already been settled (FR-C4 FR-C7).
     */
    @PostMapping("/runs/{runId}/shop/actions/skip")
    public ResponseEntity<ManageResponse<Object>> skipPveShop(@PathVariable String runId) {
        Object data = shopService.skip(currentUser.requireId(), runId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /** api.yml PveShopPurchaseRequest. */
    public record PveShopPurchaseRequest(@jakarta.validation.constraints.NotNull Integer slotIndex) {
    }
}
