package com.gomoku.dto.response;

public record QuickMatchResponse(
        boolean matched,
        String roomId,
        Integer queuePosition
) {
}
