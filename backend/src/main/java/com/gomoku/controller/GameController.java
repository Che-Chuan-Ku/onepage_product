package com.gomoku.controller;

import com.gomoku.dto.request.LocalGameCreateRequest;
import com.gomoku.dto.request.MoveCreateRequest;
import com.gomoku.dto.request.OpeningStoneCreateRequest;
import com.gomoku.dto.request.Swap2ChoiceRequest;
import com.gomoku.dto.response.CoinTossResponse;
import com.gomoku.dto.response.GameDetailResponse;
import com.gomoku.dto.response.GameStateResponse;
import com.gomoku.security.CurrentUser;
import com.gomoku.service.GameService;
import com.gomoku.web.ManageResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

/**
 * Game endpoints:
 *   startLocalGame, tossCoin, placeMove,
 *   placeOpeningStone, undoLastOpeningStone, makeSwap2Choice, rematchGame.
 * Base path: /api/gmk/v1/games
 */
@RestController
@RequestMapping("/api/gmk/v1/games")
public class GameController {

    private final GameService gameService;
    private final CurrentUser currentUser;

    public GameController(GameService gameService, CurrentUser currentUser) {
        this.gameService = gameService;
        this.currentUser = currentUser;
    }

    /**
     * POST /games — operationId: startLocalGame
     * 201 + Location on success.
     */
    @PostMapping
    public ResponseEntity<ManageResponse<GameDetailResponse>> startLocalGame(
            @Valid @RequestBody LocalGameCreateRequest req) {
        GameDetailResponse data = gameService.startLocalGame(req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(data.gameId())
                .toUri();
        return ResponseEntity.created(location).body(ManageResponse.created(data));
    }

    /**
     * GET /games/{gameId} — current game state for page load / reconnect (req #46).
     * Serious Duel: includes field/class state; hidden cells only once triggered (req #44).
     */
    @GetMapping("/{gameId}")
    public ResponseEntity<ManageResponse<GameStateResponse>> getGameState(
            @PathVariable String gameId) {
        GameStateResponse data = gameService.getGameState(gameId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /games/{gameId}/actions/coin-toss — operationId: tossCoin
     */
    @PostMapping("/{gameId}/actions/coin-toss")
    public ResponseEntity<ManageResponse<CoinTossResponse>> tossCoin(
            @PathVariable String gameId) {
        String playerId = currentUser.idOrNull();
        CoinTossResponse data = gameService.tossCoin(gameId, playerId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /games/{gameId}/moves — operationId: placeMove
     * 201 on success, 422 on illegal move.
     */
    @PostMapping("/{gameId}/moves")
    public ResponseEntity<ManageResponse<GameStateResponse>> placeMove(
            @PathVariable String gameId,
            @Valid @RequestBody MoveCreateRequest req) {
        String playerId = currentUser.idOrNull();
        GameStateResponse data = gameService.placeMove(gameId, playerId, req);
        return ResponseEntity.status(201).body(ManageResponse.created(data));
    }

    /**
     * POST /games/{gameId}/opening-stones — operationId: placeOpeningStone
     * 201 on success.
     */
    @PostMapping("/{gameId}/opening-stones")
    public ResponseEntity<ManageResponse<GameStateResponse>> placeOpeningStone(
            @PathVariable String gameId,
            @Valid @RequestBody OpeningStoneCreateRequest req) {
        String playerId = currentUser.idOrNull();
        GameStateResponse data = gameService.placeOpeningStone(gameId, playerId, req);
        return ResponseEntity.status(201).body(ManageResponse.created(data));
    }

    /**
     * POST /games/{gameId}/opening-stones/actions/undo-last — operationId: undoLastOpeningStone
     */
    @PostMapping("/{gameId}/opening-stones/actions/undo-last")
    public ResponseEntity<ManageResponse<GameStateResponse>> undoLastOpeningStone(
            @PathVariable String gameId) {
        String playerId = currentUser.idOrNull();
        GameStateResponse data = gameService.undoLastOpeningStone(gameId, playerId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /games/{gameId}/actions/swap2-choice — operationId: makeSwap2Choice
     */
    @PostMapping("/{gameId}/actions/swap2-choice")
    public ResponseEntity<ManageResponse<GameStateResponse>> makeSwap2Choice(
            @PathVariable String gameId,
            @Valid @RequestBody Swap2ChoiceRequest req) {
        String playerId = currentUser.idOrNull();
        GameStateResponse data = gameService.makeSwap2Choice(gameId, playerId, req);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /games/{gameId}/actions/rematch — operationId: rematchGame
     * 201 + Location on success.
     */
    @PostMapping("/{gameId}/actions/rematch")
    public ResponseEntity<ManageResponse<GameDetailResponse>> rematchGame(
            @PathVariable String gameId) {
        GameDetailResponse data = gameService.rematchGame(gameId);
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/gmk/v1/games/{id}")
                .buildAndExpand(data.gameId())
                .toUri();
        return ResponseEntity.status(201).body(ManageResponse.created(data));
    }
}
