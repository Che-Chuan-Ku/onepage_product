package com.gomoku.domain.enums;

/** PVE encounter event stream types (erm.dbml pve_encounter_event_type). */
public enum PveEncounterEventType {
    LINE_RESOLVED,
    SKILL_USED,
    STONES_PUSHED,
    STONE_REMOVED_OFF_BOARD,
    VOLCANO_ERUPTED,
    WAVE_SURGED,
    TIDE_TRIGGERED,
    BOSS_MUTATION_TRIGGERED,
    ENCOUNTER_CLEARED,
    ENCOUNTER_FAILED
}
