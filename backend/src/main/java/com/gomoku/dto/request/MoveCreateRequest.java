package com.gomoku.dto.request;

import jakarta.validation.Valid;

/**
 * api.yml MoveCreateRequest (oneOf, req #36):
 *  - Normal branch: row/col required (plain move, or with an attached normal skill).
 *  - Ultimate branch: skill only (ultimate replaces the placement); row/col forbidden.
 * The oneOf shape rules are validated server-side and violations return 422.
 *
 * Deliberately NOT bounds-checked with @Min/@Max here (same fix as
 * PveMoveCreateRequest, 2026-07-08): row/col schema bounds 0..15 in api.yml are
 * only the union of both field types (volcano max 14, beach max 15); the real
 * bound depends on the game's field type and is re-validated by
 * GameService.placeMove (GomokuRules.inBounds, normal mode) and
 * SeriousDuelService (SeriousBoard.inBounds, serious-duel mode), both of which
 * throw BusinessException(INVALID_MOVE, "座標超出棋盤範圍") -> 422 per api.yml
 * (specs/api.yml:590-594, :1335-1338). A @Min/@Max here would short-circuit
 * Bean Validation before those checks ever run, surfacing a generic 400
 * "請求參數錯誤" instead of the spec-mandated 422 for out-of-range coordinates.
 * Null row/col (Ultimate branch omits them) is likewise handled at the service
 * layer, not here, since the oneOf shape allows either branch.
 */
public record MoveCreateRequest(
        Integer row,
        Integer col,
        @Valid SkillActionRequest skill
) {
}
