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
    /** DUEL encounters only (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §1.5/§5.1): the boss's reply stone after each player move. */
    BOSS_MOVE_PLACED,
    ENCOUNTER_CLEARED,
    ENCOUNTER_FAILED,
    /** DUEL encounters only (§1.5/§6.5 2026-07-09 公平性修正): move budget exhausted, neither side got five-in-a-row — DRAW, not FAILED (run not forfeited). */
    ENCOUNTER_DRAWN
}
