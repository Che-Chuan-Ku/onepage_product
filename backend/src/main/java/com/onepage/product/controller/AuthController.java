package com.onepage.product.controller;

import com.onepage.product.dto.auth.*;
import com.onepage.product.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/auth/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = httpRequest.getRemoteAddr();
        return ResponseEntity.ok(authService.login(request, clientIp));
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<TokenResponse> refreshToken(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.refreshToken(body.get("refreshToken")));
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDTO>> listUsers() {
        return ResponseEntity.ok(authService.listUsers());
    }

    // REQ-033: 建立使用者（管理員限定）
    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.createUser(request));
    }

    @PutMapping("/users/{userId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDTO> updateUserRole(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.updateUserRole(userId, body.get("role")));
    }
}
