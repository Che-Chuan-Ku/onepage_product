package com.gomoku.domain.enums;

/**
 * Single-shot "minor disruption" applied only to non-mutation encounters
 * (sequence 1/2/4/5/7) — documents/PVE-關卡重設計-2026-07-08.md §5: adds
 * combinatorial variety without stacking with ONE_EYE/RAGE/ABYSS.
 * PULSE_CLEAR mirrors a single small-scale RAGE-style clear (no boss damage
 * except relic effects); PULSE_PUSH mirrors a single WAVE-style one-row push.
 * Fires at most once per encounter, at the halfway point of its move budget.
 */
public enum PveMinorDisruptionType {
    NONE,
    PULSE_CLEAR,
    PULSE_PUSH
}
