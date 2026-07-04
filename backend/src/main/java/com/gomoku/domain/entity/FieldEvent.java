package com.gomoku.domain.entity;

import com.gomoku.domain.enums.FieldEventType;
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
 * Immutable skill/field effect event stream (req #37 #38 #47).
 * Source of truth for board reconstruction and replay; detail holds a
 * self-contained JSON description of the effect (server-side only).
 */
@Entity
@Table(name = "field_events")
public class FieldEvent {

    @Id
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;

    @Column(name = "game_id", length = 36, nullable = false)
    private String gameId;

    /** Move number the effect settles after; null for FIELD_GENERATED (pre-game). */
    @Column(name = "move_number")
    private Integer moveNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private FieldEventType eventType;

    @Column(name = "\"row\"")
    private Integer row;

    @Column(name = "\"col\"")
    private Integer col;

    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @PrePersist
    void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (occurredAt == null) {
            occurredAt = Instant.now();
        }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getGameId() { return gameId; }
    public void setGameId(String gameId) { this.gameId = gameId; }

    public Integer getMoveNumber() { return moveNumber; }
    public void setMoveNumber(Integer moveNumber) { this.moveNumber = moveNumber; }

    public FieldEventType getEventType() { return eventType; }
    public void setEventType(FieldEventType eventType) { this.eventType = eventType; }

    public Integer getRow() { return row; }
    public void setRow(Integer row) { this.row = row; }

    public Integer getCol() { return col; }
    public void setCol(Integer col) { this.col = col; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
}
