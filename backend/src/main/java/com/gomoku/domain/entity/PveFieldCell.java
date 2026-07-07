package com.gomoku.domain.entity;

import com.gomoku.domain.enums.FieldCellKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * PVE generation-time field cell (FR-C2): OBSTACLE visible from start;
 * ERUPTION/TIDE server-only until triggered. Abyss-generated obstacle STONES
 * are deliberately NOT stored here (erm note notwithstanding) — they are
 * pushable/removable so they live in the pve_encounter_events stream and are
 * reconstructed by PveBoardReplayer; a static cell row cannot represent a
 * stone that moves.
 */
@Entity
@Table(name = "pve_field_cells")
public class PveFieldCell extends BaseEntity {

    @Column(name = "encounter_id", length = 36, nullable = false)
    private String encounterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "cell_kind", length = 20, nullable = false)
    private FieldCellKind cellKind;

    @Column(name = "\"row\"", nullable = false)
    private int row;

    @Column(name = "\"col\"", nullable = false)
    private int col;

    @Column(name = "visible_to_player", nullable = false)
    private boolean visibleToPlayer = false;

    @Column(name = "triggered", nullable = false)
    private boolean triggered = false;

    @Column(name = "triggered_at")
    private Instant triggeredAt;

    public String getEncounterId() { return encounterId; }
    public void setEncounterId(String encounterId) { this.encounterId = encounterId; }

    public FieldCellKind getCellKind() { return cellKind; }
    public void setCellKind(FieldCellKind cellKind) { this.cellKind = cellKind; }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public boolean isVisibleToPlayer() { return visibleToPlayer; }
    public void setVisibleToPlayer(boolean visibleToPlayer) { this.visibleToPlayer = visibleToPlayer; }

    public boolean isTriggered() { return triggered; }
    public void setTriggered(boolean triggered) { this.triggered = triggered; }

    public Instant getTriggeredAt() { return triggeredAt; }
    public void setTriggeredAt(Instant triggeredAt) { this.triggeredAt = triggeredAt; }
}
