package com.gomoku.dto.response;

/**
 * Broadcast to /topic/room/{roomId} when an ONLINE game is started from a room
 * (after both players Ready). Both clients receive the SAME gameId and navigate
 * to the opening (Swap2) or game page. Distinguished from RoomDetailResponse
 * broadcasts by the presence of the {@code gameId} field.
 */
public record GameStartedEvent(
        String event,                  // always "GameStarted"
        String gameId,
        boolean useSwap2,
        String status,                 // OPENING (swap2) | PLAYING (standard)
        String tentativeFirstPlayerId, // swap2 only; else null
        String blackPlayerId,          // standard only; else null
        String whitePlayerId,          // standard only; else null
        // Serious Duel: classes are revealed exactly when the game turns
        // PLAYING (ClassesRevealed payload, req #35); null otherwise.
        String battleMode,             // NORMAL | SERIOUS_DUEL
        String fieldType,              // serious duel only; else null
        String blackClass,
        String whiteClass
) {
}
