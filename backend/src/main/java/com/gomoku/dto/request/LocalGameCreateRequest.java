package com.gomoku.dto.request;

import jakarta.validation.constraints.NotNull;

public record LocalGameCreateRequest(
        @NotNull Boolean useSwap2,
        String blackNickname,
        String whiteNickname
) {
}
