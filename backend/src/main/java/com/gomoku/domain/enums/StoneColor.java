package com.gomoku.domain.enums;

public enum StoneColor {
    BLACK,
    WHITE;

    public StoneColor opposite() {
        return this == BLACK ? WHITE : BLACK;
    }
}
