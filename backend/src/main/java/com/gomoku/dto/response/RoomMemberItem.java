package com.gomoku.dto.response;

public record RoomMemberItem(
        String playerId,
        String nickname,
        String role,
        boolean isReady
) {
}
