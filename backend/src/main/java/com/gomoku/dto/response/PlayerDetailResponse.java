package com.gomoku.dto.response;

public record PlayerDetailResponse(
        String playerId,
        String username,
        String email
) {
}
