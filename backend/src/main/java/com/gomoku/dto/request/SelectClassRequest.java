package com.gomoku.dto.request;

import com.gomoku.domain.enums.ClassType;
import jakarta.validation.constraints.NotNull;

/** api.yml SelectClassRequest (req #35). */
public record SelectClassRequest(
        @NotNull ClassType classType
) {
}
