package com.gomoku.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** api.yml PveRunResultResponse: run settlement (FR-C7). */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record PveRunResultResponse(
        String runId,
        String status,
        int reachedEncounterSequence,
        long totalDamageDealt,
        int goldEarned,
        int goldSpent,
        List<PveRunStateResponse.HeldSkill> finalHeldSkills,
        List<PveRunStateResponse.HeldRelic> finalHeldRelics
) {
}
