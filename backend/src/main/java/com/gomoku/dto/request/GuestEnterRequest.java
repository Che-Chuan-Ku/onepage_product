package com.gomoku.dto.request;

import jakarta.validation.constraints.NotBlank;

public record GuestEnterRequest(
        @NotBlank String nickname
) {
}
