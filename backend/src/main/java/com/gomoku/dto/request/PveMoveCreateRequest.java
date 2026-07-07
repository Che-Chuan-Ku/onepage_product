package com.gomoku.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** api.yml PveMoveCreateRequest: plain placement on the 11x11 board (FR-B2). */
public record PveMoveCreateRequest(
        @NotNull @Min(0) @Max(10) Integer row,
        @NotNull @Min(0) @Max(10) Integer col
) {
}
