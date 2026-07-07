package com.gomoku.domain.entity;

import com.gomoku.domain.enums.BoardSide;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Per-encounter field state (FR-C2): beach erosion progress + wave counter
 * (PVE counts single-player placements, 10 per wave). Created for every
 * encounter (sea_side null for non-BEACH) to keep reconnect reads uniform.
 */
@Entity
@Table(name = "pve_field_states")
public class PveFieldState extends BaseEntity {

    @Column(name = "encounter_id", length = 36, nullable = false)
    private String encounterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sea_side", length = 10)
    private BoardSide seaSide;

    @Column(name = "eroded_rows", nullable = false)
    private int erodedRows = 0;

    @Column(name = "tide_triggered", nullable = false)
    private boolean tideTriggered = false;

    @Column(name = "wave_move_counter", nullable = false)
    private int waveMoveCounter = 0;

    public String getEncounterId() { return encounterId; }
    public void setEncounterId(String encounterId) { this.encounterId = encounterId; }

    public BoardSide getSeaSide() { return seaSide; }
    public void setSeaSide(BoardSide seaSide) { this.seaSide = seaSide; }

    public int getErodedRows() { return erodedRows; }
    public void setErodedRows(int erodedRows) { this.erodedRows = erodedRows; }

    public boolean isTideTriggered() { return tideTriggered; }
    public void setTideTriggered(boolean tideTriggered) { this.tideTriggered = tideTriggered; }

    public int getWaveMoveCounter() { return waveMoveCounter; }
    public void setWaveMoveCounter(int waveMoveCounter) { this.waveMoveCounter = waveMoveCounter; }
}
