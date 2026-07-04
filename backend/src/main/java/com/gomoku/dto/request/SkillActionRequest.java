package com.gomoku.dto.request;

import com.gomoku.domain.enums.SkillDirection;
import com.gomoku.domain.enums.SkillType;
import jakarta.validation.constraints.NotNull;

/**
 * Serious Duel skill payload (api.yml SkillActionRequest, req #36 #42 #43).
 * Normal skills (slash/snipe/scatter) attach to this turn's stone placement;
 * ultimates (reversal/pioneer star) replace the placement — outer row/col must
 * then be absent (oneOf semantics enforced server-side, 422 on violation).
 */
public record SkillActionRequest(
        @NotNull SkillType skillType,
        SkillDirection direction,
        CellRef anchor,
        CellRef target,
        CellRef secondStone
) {
    public record CellRef(Integer row, Integer col) {
    }
}
