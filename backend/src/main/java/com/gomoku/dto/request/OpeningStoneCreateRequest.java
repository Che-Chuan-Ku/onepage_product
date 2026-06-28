package com.gomoku.dto.request;

import com.gomoku.domain.enums.StoneColor;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record OpeningStoneCreateRequest(
        @NotNull @Min(0) @Max(14) Integer row,
        @NotNull @Min(0) @Max(14) Integer col,
        @NotNull StoneColor color
) {
}
