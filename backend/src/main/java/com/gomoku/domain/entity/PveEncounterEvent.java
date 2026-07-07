package com.gomoku.domain.entity;

import com.gomoku.domain.enums.PveEncounterEventType;
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
 * Immutable PVE effect event stream (FR-B2/B3/B5/C6). move_number semantics:
 * settlement events carry the triggering move's number; SKILL_USED carries the
 * count of completed moves at cast time (the "interval index", FR-B5).
 */
@Entity
@Table(name = "pve_encounter_events")
public class PveEncounterEvent {

    @Id
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;

    @Column(name = "encounter_id", length = 36, nullable = false)
    private String encounterId;

    @Column(name = "move_number")
    private Integer moveNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", length = 30, nullable = false)
    private PveEncounterEventType eventType;

    @Column(name = "\"row\"")
    private Integer row;

    @Column(name = "\"col\"")
    private Integer col;

    @Column(name = "detail")
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

    public String getEncounterId() { return encounterId; }
    public void setEncounterId(String encounterId) { this.encounterId = encounterId; }

    public Integer getMoveNumber() { return moveNumber; }
    public void setMoveNumber(Integer moveNumber) { this.moveNumber = moveNumber; }

    public PveEncounterEventType getEventType() { return eventType; }
    public void setEventType(PveEncounterEventType eventType) { this.eventType = eventType; }

    public Integer getRow() { return row; }
    public void setRow(Integer row) { this.row = row; }

    public Integer getCol() { return col; }
    public void setCol(Integer col) { this.col = col; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
}
