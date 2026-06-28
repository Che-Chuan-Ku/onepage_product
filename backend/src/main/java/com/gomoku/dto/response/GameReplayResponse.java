package com.gomoku.dto.response;

import java.util.List;

public record GameReplayResponse(
        String gameId,
        String result,
        String winnerPlayerId,
        int moveCount,
        boolean useSwap2,
        List<OpeningStoneItem> openingStones,
        List<MoveItem> moves
) {
    public record OpeningStoneItem(int sequence, String color, int row, int col) {
    }

    public record MoveItem(int moveNumber, String color, int row, int col) {
    }
}
