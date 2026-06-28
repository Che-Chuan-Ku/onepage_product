package com.gomoku.dto.response;

public record GameDetailResponse(
        String gameId,
        String gameMode,
        boolean useSwap2,
        String status,
        String currentTurn
) {
}
