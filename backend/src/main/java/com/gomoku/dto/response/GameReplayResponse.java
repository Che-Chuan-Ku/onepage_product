package com.gomoku.dto.response;

import java.util.List;

public record GameReplayResponse(
        String gameId,
        String result,
        String winnerPlayerId,
        int moveCount,
        boolean useSwap2,
        // Additive (bug fix): authoritative "whose turn now" for page-load/reconnect
        // rendering. moveCount parity is NOT reliable for Serious Duel — an ultimate
        // cast places 0 stones and scatter-shot places 2 in one hand, both of which
        // break a naive odd/even-of-moveCount inference. null once game is FINISHED.
        String currentTurn,
        List<OpeningStoneItem> openingStones,
        List<MoveItem> moves,
        // Additive fields so the game page can resolve real nicknames + correct
        // black/white assignment (bug fix: was hardcoded on the frontend).
        // roomId lets it fetch room members for nicknames; null for LOCAL games.
        String roomId,
        String blackPlayerId,
        String whitePlayerId,
        // Serious Duel replay (req #47): mode/field/classes + skill & field event
        // sequence. Hidden cells appear only via their trigger events (VOLCANO_ERUPTED
        // / TIDE_TRIGGERED carry row/col), so post-game replay reveals them.
        String battleMode,
        String fieldType,
        String blackClass,
        String whiteClass,
        List<FieldEventItem> fieldEvents,
        // Per-player used-skill history (R2-3: restore used-skill state on reconnect,
        // same as field state — frontend has no other source since it tracks this
        // client-side only). Empty/omitted for NORMAL games.
        List<SkillUsageItem> skillUsages,
        // Bug fix (additive): FIELD_GENERATED events above carry row=null/col=null,
        // so obstacle layout / beach ocean side cannot be inferred from fieldEvents
        // alone. Authoritative snapshot mirroring GameStateResponse.fieldState, so
        // replay/reconnect renders the field correctly. Empty/null for NORMAL games.
        List<Cell> obstacles,
        String seaSide
) {
    public record OpeningStoneItem(int sequence, String color, int row, int col) {
    }

    public record MoveItem(int moveNumber, String color, int row, int col) {
    }

    /** moveNumber null = pre-game FIELD_GENERATED. */
    public record FieldEventItem(Integer moveNumber, String eventType, Integer row, Integer col) {
    }

    public record SkillUsageItem(String playerId, String skillType) {
    }

    public record Cell(int row, int col) {
    }
}
