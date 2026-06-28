package com.gomoku.controller;

import com.gomoku.dto.response.LeaderboardEntryResponse;
import com.gomoku.dto.response.PlayerStatsResponse;
import com.gomoku.service.PlayerService;
import com.gomoku.web.ManageResponse;
import com.gomoku.web.PageData;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Player endpoints: getPlayerStats, getLeaderboard.
 * Base path: /api/gmk/v1
 */
@RestController
@RequestMapping("/api/gmk/v1")
public class PlayerController {

    private final PlayerService playerService;

    public PlayerController(PlayerService playerService) {
        this.playerService = playerService;
    }

    /**
     * GET /players/{playerId}/stats — operationId: getPlayerStats
     */
    @GetMapping("/players/{playerId}/stats")
    public ResponseEntity<ManageResponse<PlayerStatsResponse>> getPlayerStats(
            @PathVariable String playerId) {
        PlayerStatsResponse data = playerService.getStats(playerId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * GET /leaderboard — operationId: getLeaderboard
     * Query params: skip (default 0), top (default 20), order (ignored — fixed sort).
     */
    @GetMapping("/leaderboard")
    public ResponseEntity<ManageResponse<PageData<LeaderboardEntryResponse>>> getLeaderboard(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(defaultValue = "20") int top,
            @RequestParam(defaultValue = "wins desc, winRate desc") String order) {
        PageData<LeaderboardEntryResponse> data = playerService.getLeaderboard(skip, top);
        return ResponseEntity.ok(ManageResponse.success(data));
    }
}
