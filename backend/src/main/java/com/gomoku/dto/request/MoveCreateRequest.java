package com.gomoku.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record MoveCreateRequest(
        @NotNull @Min(0) @Max(14) Integer row,
        @NotNull @Min(0) @Max(14) Integer col
) {
}
