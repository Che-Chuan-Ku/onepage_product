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
 * Swap2 opening stones — event stream; may be physically removed by "undo last".
 * (erm.dbml: exempt from updated_at/version.)
 */
@Entity
@Table(name = "opening_stones")
public class OpeningStone {

    @Id
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;

    @Column(name = "game_id", length = 36, nullable = false)
    private String gameId;

    @Column(name = "sequence", nullable = false)
    private int sequence;

    @Enumerated(EnumType.STRING)
    @Column(name = "color", nullable = false, length = 10)
    private StoneColor color;

    @Column(name = "\"row\"", nullable = false)
    private int row;

    @Column(name = "\"col\"", nullable = false)
    private int col;

    // Nullable: LOCAL Swap2 games have no authenticated player (api.yml allows
    // anonymous opening placement); null = placed on the local device.
    @Column(name = "placed_by_player_id", length = 36)
    private String placedByPlayerId;

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

    public int getSequence() { return sequence; }
    public void setSequence(int sequence) { this.sequence = sequence; }

    public StoneColor getColor() { return color; }
    public void setColor(StoneColor color) { this.color = color; }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public String getPlacedByPlayerId() { return placedByPlayerId; }
    public void setPlacedByPlayerId(String placedByPlayerId) { this.placedByPlayerId = placedByPlayerId; }

    public Instant getPlacedAt() { return placedAt; }
    public void setPlacedAt(Instant placedAt) { this.placedAt = placedAt; }
}
