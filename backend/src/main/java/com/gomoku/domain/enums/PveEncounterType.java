package com.gomoku.domain.enums;

/**
 * PVE encounter play mode (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §1.0):
 * PUZZLE = existing pre-placed-shape + line-damage encounters (sequences
 * 1/2/3/5/6/7); DUEL = boss-duel encounters with no HP/damage/mutation, won
 * by connecting five, lost on the boss connecting five or exhausting the move
 * budget (sequences 4/8 fixed).
 */
public enum PveEncounterType {
    PUZZLE,
    DUEL
}
