package com.gomoku.domain.entity;

import com.gomoku.domain.enums.StoneColor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable move-event stream (erm.dbml: exempt from audit columns).
 */
@Entity
@Table(name = "moves")
public class Move {

    @Id
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;

    @Column(name = "game_id", length = 36, nullable = false)
    private String gameId;

    @Column(name = "move_number", nullable = false)
    private int moveNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "color", nullable = false, length = 10)
    private StoneColor color;

    @Column(name = "\"row\"", nullable = false)
    private int row;

    @Column(name = "\"col\"", nullable = false)
    private int col;

    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;

    @PrePersist
    void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (placedAt == null) {
            placedAt = Instant.now();
        }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getGameId() { return gameId; }
    public void setGameId(String gameId) { this.gameId = gameId; }

    public int getMoveNumber() { return moveNumber; }
    public void setMoveNumber(int moveNumber) { this.moveNumber = moveNumber; }

    public StoneColor getColor() { return color; }
    public void setColor(StoneColor color) { this.color = color; }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public Instant getPlacedAt() { return placedAt; }
    public void setPlacedAt(Instant placedAt) { this.placedAt = placedAt; }
}
