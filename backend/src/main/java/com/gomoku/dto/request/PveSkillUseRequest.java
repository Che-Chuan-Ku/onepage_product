package com.gomoku.dto.request;

import com.gomoku.domain.enums.SkillDirection;
import com.gomoku.domain.enums.SkillType;
import jakarta.validation.constraints.NotNull;

/**
 * api.yml PveSkillUseRequest (allOf SkillActionRequest): independent-action
 * skill cast (FR-A2 FR-B5) — no outer row/col; slashes take anchor+direction,
 * snipe takes target, scatter takes anchor+secondStone, ultimates take
 * anchor+direction.
 */
public record PveSkillUseRequest(
        @NotNull SkillType skillType,
        SkillDirection direction,
        SkillActionRequest.CellRef anchor,
        SkillActionRequest.CellRef target,
        SkillActionRequest.CellRef secondStone
) {
}
