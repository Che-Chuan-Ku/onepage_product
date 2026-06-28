package com.gomoku.dto.response;

public record RecentGameItem(
        String gameId,
        String result,
        String endedAt
) {
}
