package com.gomoku.domain.enums;

/**
 * PVE 11x11 field variants (FR-B1 FR-C2). VOLCANO/BEACH here are NEW 11x11
 * geometry specs — they do not share board size with the Serious Duel
 * FieldType (VOLCANO=15x15, BEACH=16x16).
 */
public enum PveFieldType {
    PLAIN,
    VOLCANO,
    BEACH
}
