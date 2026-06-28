package com.gomoku.dto.response;

public record LeaderboardEntryResponse(
        int rank,
        String playerId,
        String username,
        int wins,
        int losses,
        double winRate
) {
}
