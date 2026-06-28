package com.gomoku.controller;

import com.gomoku.dto.response.GameReplayResponse;
import com.gomoku.service.GameService;
import com.gomoku.web.ManageResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * History endpoint: getGameReplay.
 * Base path: /api/gmk/v1/games
 */
@RestController
@RequestMapping("/api/gmk/v1/games")
public class HistoryController {

    private final GameService gameService;

    public HistoryController(GameService gameService) {
        this.gameService = gameService;
    }

    /**
     * GET /games/{gameId}/replay — operationId: getGameReplay
     */
    @GetMapping("/{gameId}/replay")
    public ResponseEntity<ManageResponse<GameReplayResponse>> getGameReplay(
            @PathVariable String gameId) {
        GameReplayResponse data = gameService.getGameReplay(gameId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }
}
