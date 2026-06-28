package com.gomoku.dto.response;

import java.util.List;

public record PlayerStatsResponse(
        String playerId,
        int wins,
        int losses,
        int draws,
        double winRate,
        List<RecentGameItem> recentGames
) {
}
