package com.gomoku.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * api.yml MoveCreateRequest (oneOf, req #36):
 *  - Normal branch: row/col required (plain move, or with an attached normal skill).
 *  - Ultimate branch: skill only (ultimate replaces the placement); row/col forbidden.
 * The oneOf shape rules are validated server-side and violations return 422.
 * row/col schema bounds 0..15 are the union of both fields; the effective bound
 * (volcano/normal 14, beach 15) is re-validated against the game's field type.
 */
public record MoveCreateRequest(
        @Min(0) @Max(15) Integer row,
        @Min(0) @Max(15) Integer col,
        @Valid SkillActionRequest skill
) {
}
