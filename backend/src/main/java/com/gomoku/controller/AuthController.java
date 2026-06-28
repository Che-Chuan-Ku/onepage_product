package com.gomoku.controller;

import com.gomoku.dto.request.GuestEnterRequest;
import com.gomoku.dto.request.LoginRequest;
import com.gomoku.dto.request.RegisterRequest;
import com.gomoku.dto.response.GuestEnterResponse;
import com.gomoku.dto.response.LoginResponse;
import com.gomoku.dto.response.PlayerDetailResponse;
import com.gomoku.service.AuthService;
import com.gomoku.web.ManageResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

/**
 * Auth endpoints: registerPlayer, loginPlayer, enterAsGuest.
 * Base path: /api/gmk/v1/auth
 */
@RestController
@RequestMapping("/api/gmk/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * POST /auth/register — operationId: registerPlayer
     * 201 + Location header on success.
     */
    @PostMapping("/register")
    public ResponseEntity<ManageResponse<PlayerDetailResponse>> registerPlayer(
            @Valid @RequestBody RegisterRequest req) {
        PlayerDetailResponse data = authService.register(req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(data.playerId())
                .toUri();
        return ResponseEntity.created(location).body(ManageResponse.created(data));
    }

    /**
     * POST /auth/login — operationId: loginPlayer
     */
    @PostMapping("/login")
    public ResponseEntity<ManageResponse<LoginResponse>> loginPlayer(
            @Valid @RequestBody LoginRequest req) {
        LoginResponse data = authService.login(req);
        return ResponseEntity.ok(ManageResponse.success(data));
    }

    /**
     * POST /auth/guest — operationId: enterAsGuest
     */
    @PostMapping("/guest")
    public ResponseEntity<ManageResponse<GuestEnterResponse>> enterAsGuest(
            @Valid @RequestBody GuestEnterRequest req) {
        GuestEnterResponse data = authService.enterAsGuest(req);
        return ResponseEntity.ok(ManageResponse.success(data));
    }
}
