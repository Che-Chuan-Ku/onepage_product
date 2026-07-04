package com.gomoku.domain.enums;

/** Immutable skill/field effect event stream types (req #37 #38 #47). */
public enum FieldEventType {
    FIELD_GENERATED,
    STONE_PUSHED,
    STONE_REMOVED_OFF_BOARD,
    STONES_BURNED,
    STONE_REPLACED,
    STONES_CLEARED,
    COLORS_SWAPPED,
    VOLCANO_ERUPTED,
    WAVE_SURGED,
    TIDE_TRIGGERED,
    TIDE_RISEN,
    SAND_ERODED
}
