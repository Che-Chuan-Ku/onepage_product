package com.gomoku.dto.response;

import java.util.List;

public record GameReplayResponse(
        String gameId,
        String result,
        String winnerPlayerId,
        int moveCount,
        boolean useSwap2,
        List<OpeningStoneItem> openingStones,
        List<MoveItem> moves,
        // Additive fields so the game page can resolve real nicknames + correct
        // black/white assignment (bug fix: was hardcoded on the frontend).
        // roomId lets it fetch room members for nicknames; null for LOCAL games.
        String roomId,
        String blackPlayerId,
        String whitePlayerId
) {
    public record OpeningStoneItem(int sequence, String color, int row, int col) {
    }

    public record MoveItem(int moveNumber, String color, int row, int col) {
    }
}
