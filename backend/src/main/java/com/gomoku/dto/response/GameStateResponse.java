package com.gomoku.dto.response;

import java.util.List;

public record GameStateResponse(
        String gameId,
        String status,
        String currentTurn,
        int moveCount,
        LastMove lastMove,
        String result,
        List<Cell> winningLine
) {
    public record LastMove(String color, int row, int col) {
    }

    public record Cell(int row, int col) {
    }
}
