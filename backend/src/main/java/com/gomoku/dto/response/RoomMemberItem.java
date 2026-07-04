package com.gomoku.dto.response;

/**
 * classType visibility (Q8, R2-2): before the game starts, opposing PLAYERs see
 * null for each other's choice; the member themself and SPECTATOR viewers always
 * see the real value. After the game starts (ClassesRevealed) everyone sees it.
 */
public record RoomMemberItem(
        String playerId,
        String nickname,
        String role,
        boolean isReady,
        String classType
) {
}
