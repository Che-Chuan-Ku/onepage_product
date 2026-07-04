package com.gomoku.dto.request;

import com.gomoku.domain.enums.BattleMode;
import com.gomoku.domain.enums.FieldType;
import com.gomoku.domain.enums.RoomVisibility;
import jakarta.validation.constraints.NotNull;

public record RoomCreateRequest(
        @NotNull RoomVisibility visibility,
        Boolean isSwap2Mode,
        BattleMode battleMode,
        FieldType fieldType
) {
    public boolean swap2() {
        return Boolean.TRUE.equals(isSwap2Mode);
    }

    /** battleMode defaults to NORMAL when omitted (api.yml default). */
    public BattleMode battleModeOrDefault() {
        return battleMode == null ? BattleMode.NORMAL : battleMode;
    }
}
