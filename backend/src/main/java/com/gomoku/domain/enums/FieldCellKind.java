package com.gomoku.domain.enums;

/**
 * Field cell kinds (req #39 #40 #44). OBSTACLE visible; ERUPTION/TIDE
 * server-only until triggered. INITIAL_BLACK is a pre-placed player stone
 * baked into the encounter's starting board (documents/PVE-關卡重設計-2026-07-08.md
 * §0/§6): PveBoardReplayer applies these BEFORE any move/event so they show up
 * in PveEncounterStateResponse.stones from the very first read — no separate
 * API field is needed.
 */
public enum FieldCellKind {
    OBSTACLE,
    ERUPTION,
    TIDE,
    INITIAL_BLACK
}
