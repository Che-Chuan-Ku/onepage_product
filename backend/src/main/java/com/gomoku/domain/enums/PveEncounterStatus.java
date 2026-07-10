package com.gomoku.domain.enums;

/**
 * PVE encounter outcome (FR-B4). {@code DRAW} (2026-07-09 魔王對弈公平性修正
 * — documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §1.5/§6.5): DUEL-only —
 * move budget exhausted with NEITHER side having completed a five-in-a-row.
 * Distinct from {@code FAILED}: the run is NOT forfeited (stays IN_PROGRESS,
 * not LOST) and the encounter is retryable in place via
 * {@code PveChallengeService#retryDuelEncounter} — an unlimited number of
 * times, each attempt getting a fresh boss-AI RNG stream.
 */
public enum PveEncounterStatus {
    IN_PROGRESS,
    CLEARED,
    FAILED,
    DRAW
}
