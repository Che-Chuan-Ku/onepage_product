package com.gomoku.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** api.yml PveRunStateResponse: run overview + current encounter (FR-B6 FR-C8). */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record PveRunStateResponse(
        String runId,
        String classType,
        String status,
        int gold,
        int currentEncounterSequence,
        int reachedEncounterSequence,
        long totalDamageDealt,
        PveEncounterStateResponse currentEncounter,
        List<HeldSkill> heldSkills,
        List<HeldRelic> heldRelics
) {
    public record HeldSkill(String skillType, int quantity) {
    }

    public record HeldRelic(String relicType) {
    }
}
