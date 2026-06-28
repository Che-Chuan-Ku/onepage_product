package com.gomoku.dto.request;

import com.gomoku.domain.enums.Swap2Choice;
import jakarta.validation.constraints.NotNull;

public record Swap2ChoiceRequest(
        @NotNull Swap2Choice choice
) {
}
