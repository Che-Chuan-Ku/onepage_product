package com.gomoku.dto.response;

public record LoginResponse(
        String token,
        String playerId
) {
}
