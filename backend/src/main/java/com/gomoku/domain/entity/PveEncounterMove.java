package com.gomoku.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** Immutable PVE move-event stream (erm.dbml: exempt from audit columns). */
@Entity
@Table(name = "pve_encounter_moves")
public class PveEncounterMove {

    @Id
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;

    @Column(name = "encounter_id", length = 36, nullable = false)
    private String encounterId;

    @Column(name = "encounter_move_number", nullable = false)
    private int encounterMoveNumber;

    @Column(name = "run_move_number", nullable = false)
    private int runMoveNumber;

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

    public String getEncounterId() { return encounterId; }
    public void setEncounterId(String encounterId) { this.encounterId = encounterId; }

    public int getEncounterMoveNumber() { return encounterMoveNumber; }
    public void setEncounterMoveNumber(int encounterMoveNumber) { this.encounterMoveNumber = encounterMoveNumber; }

    public int getRunMoveNumber() { return runMoveNumber; }
    public void setRunMoveNumber(int runMoveNumber) { this.runMoveNumber = runMoveNumber; }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public Instant getPlacedAt() { return placedAt; }
    public void setPlacedAt(Instant placedAt) { this.placedAt = placedAt; }
}
