package com.gomoku.dto.response;

public record GameDetailResponse(
        String gameId,
        String gameMode,
        boolean useSwap2,
        String battleMode,
        String fieldType,
        String status,
        String currentTurn
) {
}
