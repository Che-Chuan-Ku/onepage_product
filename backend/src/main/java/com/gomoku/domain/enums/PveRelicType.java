package com.gomoku.domain.enums;

/** Relic pool with shop prices (FR-C4 FR-C5). */
public enum PveRelicType {
    SHARP_BLADE(8),
    CHAIN_CORE(6),
    DIAGONAL_WALKER(10),
    VOLCANO_HEART(10),
    TIDE_BREAKWATER(8),
    METRONOME(12),
    RECYCLER(10),
    GEMINI_STAR(14);

    private final int price;

    PveRelicType(int price) {
        this.price = price;
    }

    public int getPrice() { return price; }
}
