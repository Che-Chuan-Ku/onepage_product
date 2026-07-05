package com.gomoku.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * api.yml GameStateResponse. Serious-Duel-only fields (blackClass/whiteClass/
 * fieldState/revealedHiddenCells/skillEvents) are null for NORMAL games.
 * Hidden cells (untriggered ERUPTION/TIDE) are server-only and never appear
 * here for any viewer, players and spectators alike (req #44, R2-2).
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record GameStateResponse(
        String gameId,
        String status,
        String currentTurn,
        int moveCount,
        LastMove lastMove,
        String result,
        List<Cell> winningLine,
        // Serious Duel (req #35 #39-#45); null in NORMAL mode.
        String blackClass,
        String whiteClass,
        FieldStateView fieldState,
        List<HiddenCellView> revealedHiddenCells,
        List<SkillEventView> skillEvents,
        // Additive (bug fix, req #45 real-backend rollout): the client-side
        // event replay (frontend duelClient.ts) turned out to disagree with
        // the actual per-event row/col semantics above — STONES_BURNED's
        // row/col is the ERUPTION trigger cell (not the burned neighbors),
        // STONE_PUSHED's is the push destination (not the origin the client
        // assumed) — so push/burn/swap effects never rendered correctly for
        // any viewer. skillEvents stay for FX triggers (flash/reveal cues);
        // this authoritative full-board snapshot is now the source of truth
        // for stone positions, no event math required. Null for NORMAL games
        // (frontend derives their board from lastMove append, which is exact).
        List<StoneView> stones
) {
    public record LastMove(String color, int row, int col) {
    }

    public record Cell(int row, int col) {
    }

    /** Visible field snapshot: obstacles + erosion progress; never hidden cells. */
    public record FieldStateView(
            String fieldType,
            List<Cell> obstacles,
            int erodedRows,
            boolean tideTriggered,
            int roundCounter,
            String seaSide // additive: beach ocean side (NORTH/SOUTH/EAST/WEST); null for volcano
    ) {
    }

    /** Hidden cell revealed by having been triggered (req #44). */
    public record HiddenCellView(String cellKind, int row, int col) {
    }

    /** Skill/field effect for frontend animation triggers (req #45, R2-1). */
    public record SkillEventView(String eventType, Integer row, Integer col, boolean effectTriggered) {
    }

    /** Authoritative occupied-cell snapshot (bug fix, see `stones` doc above). */
    public record StoneView(int row, int col, String color) {
    }

    /** Normal-mode constructor preserved for existing call sites. */
    public GameStateResponse(String gameId, String status, String currentTurn, int moveCount,
                             LastMove lastMove, String result, List<Cell> winningLine) {
        this(gameId, status, currentTurn, moveCount, lastMove, result, winningLine,
                null, null, null, null, null, null);
    }
}
