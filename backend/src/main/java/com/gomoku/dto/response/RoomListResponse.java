package com.gomoku.dto.response;

public record RoomListResponse(
        String roomId,
        String roomCode,
        String hostNickname,
        int playerCount,
        int spectatorCount,
        boolean isSwap2Mode,
        String battleMode,
        String fieldType
) {
}
