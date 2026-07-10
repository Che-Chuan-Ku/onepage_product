package com.gomoku.dto.request;

import jakarta.validation.constraints.NotNull;

/**
 * api.yml PveMoveCreateRequest: plain placement on the 11x11 board (FR-B2).
 *
 * Deliberately NOT bounds-checked with @Min/@Max here: 連線傷害結算.feature
 * ("落子座標超出11x11棋盤範圍遭拒" -> 422 "座標超出棋盤範圍") and api.yml both
 * specify out-of-range coordinates as a 422 business error handled by
 * PveChallengeService.placeMove's board.inBounds() check. Bean Validation
 * annotations here would short-circuit before that check ever runs, instead
 * surfacing a generic 400 "請求參數錯誤" — a real bug found and fixed during
 * integration testing (2026-07-07, Gate A contract smoke test).
 */
public record PveMoveCreateRequest(
        @NotNull Integer row,
        @NotNull Integer col
) {
}
