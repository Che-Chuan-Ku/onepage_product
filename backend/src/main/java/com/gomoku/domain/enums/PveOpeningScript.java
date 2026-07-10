package com.gomoku.domain.enums;

/**
 * DUEL encounter opening script for the boss's very first move
 * (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §1.4): borrows the RELATIVE
 * geometry of two Section-A opening formations from the puzzle library — the
 * boss's first move is scripted from the player's own first move, every move
 * after that is fully AI-policy driven (see BossAiPolicy). NONE is used by
 * every PUZZLE encounter (no boss moves at all).
 */
public enum PveOpeningScript {
    NONE,
    /** L4: "花月" — boss's move1 = (playerRow+1, playerCol), mirrored on row overflow. */
    HUAYUE,
    /** L8: "浦月" — boss's move1 = (playerRow+1, playerCol+1), each axis independently mirrored on overflow. */
    PUYUE
}
