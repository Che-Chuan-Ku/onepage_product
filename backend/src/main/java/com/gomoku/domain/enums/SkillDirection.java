package com.gomoku.domain.enums;

/**
 * Direction selector for skills (api.yml SkillActionRequest.direction):
 * horizontal slash uses UP/DOWN, vertical slash uses LEFT/RIGHT,
 * ultimates accept all four.
 */
public enum SkillDirection {
    UP(-1, 0),
    DOWN(1, 0),
    LEFT(0, -1),
    RIGHT(0, 1);

    private final int dRow;
    private final int dCol;

    SkillDirection(int dRow, int dCol) {
        this.dRow = dRow;
        this.dCol = dCol;
    }

    public int dRow() { return dRow; }
    public int dCol() { return dCol; }
}
