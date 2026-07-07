package com.gomoku.dto.request;

import com.gomoku.domain.enums.ClassType;
import jakarta.validation.constraints.NotNull;

/**
 * api.yml PveRunCreateRequest. {@code seed} is an additive optional field:
 * FR-A3 determinism tests inject a fixed seed; production clients omit it and
 * the server generates one.
 */
public record PveRunCreateRequest(
        @NotNull ClassType classType,
        String seed
) {
}
