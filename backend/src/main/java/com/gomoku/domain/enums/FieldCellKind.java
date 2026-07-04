package com.gomoku.domain.enums;

/** Field cell kinds (req #39 #40 #44). OBSTACLE visible; ERUPTION/TIDE server-only until triggered. */
public enum FieldCellKind {
    OBSTACLE,
    ERUPTION,
    TIDE
}
