package com.gomoku.domain.entity;

import com.gomoku.domain.enums.FieldCellKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Serious Duel field cell (req #39 #40 #44).
 * OBSTACLE: visible from game start, blocks placement.
 * ERUPTION/TIDE: server-only until triggered (one-time).
 */
@Entity
@Table(name = "field_cells")
public class FieldCell extends BaseEntity {

    @Column(name = "game_id", length = 36, nullable = false)
    private String gameId;

    @Enumerated(EnumType.STRING)
    @Column(name = "cell_kind", nullable = false, length = 20)
    private FieldCellKind cellKind;

    @Column(name = "\"row\"", nullable = false)
    private int row;

    @Column(name = "\"col\"", nullable = false)
    private int col;

    @Column(name = "visible_to_players", nullable = false)
    private boolean visibleToPlayers = false;

    @Column(name = "triggered", nullable = false)
    private boolean triggered = false;

    @Column(name = "triggered_at")
    private Instant triggeredAt;

    public String getGameId() { return gameId; }
    public void setGameId(String gameId) { this.gameId = gameId; }

    public FieldCellKind getCellKind() { return cellKind; }
    public void setCellKind(FieldCellKind cellKind) { this.cellKind = cellKind; }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public boolean isVisibleToPlayers() { return visibleToPlayers; }
    public void setVisibleToPlayers(boolean visibleToPlayers) { this.visibleToPlayers = visibleToPlayers; }

    public boolean isTriggered() { return triggered; }
    public void setTriggered(boolean triggered) { this.triggered = triggered; }

    public Instant getTriggeredAt() { return triggeredAt; }
    public void setTriggeredAt(Instant triggeredAt) { this.triggeredAt = triggeredAt; }
}
