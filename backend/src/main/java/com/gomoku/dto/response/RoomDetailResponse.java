package com.gomoku.dto.response;

import java.util.List;

public record RoomDetailResponse(
        String roomId,
        String roomCode,
        String visibility,
        String status,
        boolean isSwap2Mode,
        String battleMode,
        String fieldType,
        String hostPlayerId,
        String joinedAsRole,
        int spectatorCount,
        List<RoomMemberItem> members
) {
}
