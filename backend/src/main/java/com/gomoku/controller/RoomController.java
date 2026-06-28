package com.gomoku.controller;

import com.gomoku.dto.request.RoomCreateRequest;
import com.gomoku.dto.response.GameDetailResponse;
import com.gomoku.dto.response.GameStartedEvent;
import com.gomoku.dto.response.QuickMatchResponse;
import com.gomoku.dto.response.RoomDetailResponse;
import com.gomoku.dto.response.RoomListResponse;
import com.gomoku.security.CurrentUser;
import com.gomoku.service.RoomService;
import com.gomoku.web.ManageResponse;
import com.gomoku.web.PageData;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

/**
 * Room endpoints: createRoom, listPublicRooms, joinRoom, quickMatch, toggleReady.
 * Base path: /api/gmk/v1/rooms
 */
@RestController
@RequestMapping("/api/gmk/v1/rooms")
public class RoomController {

    private final RoomService roomService;
    private final CurrentUser currentUser;

    public RoomController(RoomService roomService, CurrentUser currentUser) {
        this.roomService = roomService;
        this.currentUser = currentUser;
    }

    /**
     * POST /rooms — operationId: createRoom
     * 201 + Location on success.
     */
    @PostMapping
    public ResponseEntity<ManageResponse<RoomDetailResponse>> createRoom(
            @Valid @RequestBody RoomCreateRequest req) {
        String playerId = currentUser.requireId();
        RoomDetailResponse data = roomService.createRoom(playerId, req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(data.roomId())
                .toUri();
        return ResponseEntity.created(location).body(ManageResponse.created(data));
    }

    /**
     * GET /rooms — operationId: listPublicRooms
     */
    @GetMapping
    public ResponseEntity<ManageResponse<PageData<RoomListResponse>>> listPublicRooms(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(defaultValue = "20") int top,
            @RequestParam(defaultValue = "createdAt desc") String order) {
        PageData<RoomListResponse> data = roomService.listPublicRooms(skip, top);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * GET /rooms/{roomId} — current room snapshot (members + status) for page load.
     */
    @GetMapping("/{roomId}")
    public ResponseEntity<ManageResponse<RoomDetailResponse>> getRoom(
            @PathVariable String roomId) {
        String playerId = currentUser.requireId();
        RoomDetailResponse data = roomService.getRoom(playerId, roomId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /rooms/{roomId}/actions/join — operationId: joinRoom
     */
    @PostMapping("/{roomId}/actions/join")
    public ResponseEntity<ManageResponse<RoomDetailResponse>> joinRoom(
            @PathVariable String roomId) {
        String playerId = currentUser.requireId();
        RoomDetailResponse data = roomService.joinRoom(playerId, roomId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /rooms/actions/quick-match — operationId: quickMatch
     * NOTE: Spring maps this before /{roomId}/actions/* because it has no path variable.
     */
    @PostMapping("/actions/quick-match")
    public ResponseEntity<ManageResponse<QuickMatchResponse>> quickMatch() {
        String playerId = currentUser.requireId();
        QuickMatchResponse data = roomService.quickMatch(playerId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /rooms/{roomId}/actions/toggle-ready — operationId: toggleReady
     */
    @PostMapping("/{roomId}/actions/toggle-ready")
    public ResponseEntity<ManageResponse<RoomDetailResponse>> toggleReady(
            @PathVariable String roomId) {
        String playerId = currentUser.requireId();
        RoomDetailResponse data = roomService.toggleReady(playerId, roomId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /rooms/{roomId}/actions/start-game — start the ONLINE game from a Ready room.
     * Idempotent: returns the existing game if already started (both clients may call).
     */
    @PostMapping("/{roomId}/actions/start-game")
    public ResponseEntity<ManageResponse<GameStartedEvent>> startGame(
            @PathVariable String roomId) {
        String playerId = currentUser.requireId();
        // 並發雙方呼叫由 RoomService 的悲觀鎖序列化，回傳同一對局（冪等）。
        GameStartedEvent data = roomService.startOnlineGame(playerId, roomId);
        return ResponseEntity.ok(ManageResponse.success(data));
    }
}
