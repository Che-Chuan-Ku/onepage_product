package com.gomoku.dto.response;

/**
 * token: additive field (api.yml GuestEnterResponse lists guestId/nickname and
 * does not forbid additional properties). Guests need a JWT to reach the
 * authenticated /rooms endpoints — actor spec grants them online single-game
 * access (需求 #2), which is unreachable without it.
 */
public record GuestEnterResponse(
        String guestId,
        String nickname,
        String token
) {
}
