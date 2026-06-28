package com.gomoku.dto.response;

public record CoinTossResponse(
        String gameId,
        String coinResult,
        String tentativeFirstPlayerId,
        String blackPlayerId,
        String whitePlayerId
) {
}
