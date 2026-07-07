package com.gomoku.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** api.yml PveShopStateResponse: fixed 3 slots — relic x2 + skill x1 (FR-C4). */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record PveShopStateResponse(
        String shopVisitId,
        String runId,
        int afterEncounterSequence,
        String status,
        int rerollCount,
        int gold,
        List<OfferItem> offers
) {
    public record OfferItem(int slotIndex, String offerKind, String relicType,
                            String skillType, int price, boolean purchased) {
    }
}
