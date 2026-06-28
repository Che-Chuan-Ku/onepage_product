package com.gomoku.dto.request;

import com.gomoku.domain.enums.RoomVisibility;
import jakarta.validation.constraints.NotNull;

public record RoomCreateRequest(
        @NotNull RoomVisibility visibility,
        Boolean isSwap2Mode
) {
    public boolean swap2() {
        return Boolean.TRUE.equals(isSwap2Mode);
    }
}
