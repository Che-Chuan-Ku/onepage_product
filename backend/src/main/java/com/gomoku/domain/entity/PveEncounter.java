package com.gomoku.domain.entity;

import com.gomoku.domain.enums.PveEncounterStatus;
import com.gomoku.domain.enums.PveFieldType;
import com.gomoku.domain.enums.PveMutationType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

/** One 11x11 board challenge with Boss HP + move budget (FR-B1 FR-C1 FR-C2). */
@Entity
@Table(name = "pve_encounters")
public class PveEncounter extends BaseEntity {

    @Column(name = "run_id", length = 36, nullable = false)
    private String runId;

    @Column(name = "sequence", nullable = false)
    private int sequence;

    @Enumerated(EnumType.STRING)
    @Column(name = "field_type", length = 20, nullable = false)
    private PveFieldType fieldType;

    @Enumerated(EnumType.STRING)
    @Column(name = "mutation_type", length = 20, nullable = false)
    private PveMutationType mutationType = PveMutationType.NONE;

    @Column(name = "board_rows", nullable = false)
    private int boardRows = 11;

    @Column(name = "board_cols", nullable = false)
    private int boardCols = 11;

    @Column(name = "boss_hp_max", nullable = false)
    private int bossHpMax;

    @Column(name = "boss_hp_current", nullable = false)
    private int bossHpCurrent;

    @Column(name = "move_budget", nullable = false)
    private int moveBudget = 30;

    @Column(name = "moves_used", nullable = false)
    private int movesUsed = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private PveEncounterStatus status = PveEncounterStatus.IN_PROGRESS;

    @Column(name = "cleared_at")
    private Instant clearedAt;

    @Column(name = "failed_at")
    private Instant failedAt;

    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public int getSequence() { return sequence; }
    public void setSequence(int sequence) { this.sequence = sequence; }

    public PveFieldType getFieldType() { return fieldType; }
    public void setFieldType(PveFieldType fieldType) { this.fieldType = fieldType; }

    public PveMutationType getMutationType() { return mutationType; }
    public void setMutationType(PveMutationType mutationType) { this.mutationType = mutationType; }

    public int getBoardRows() { return boardRows; }
    public void setBoardRows(int boardRows) { this.boardRows = boardRows; }

    public int getBoardCols() { return boardCols; }
    public void setBoardCols(int boardCols) { this.boardCols = boardCols; }

    public int getBossHpMax() { return bossHpMax; }
    public void setBossHpMax(int bossHpMax) { this.bossHpMax = bossHpMax; }

    public int getBossHpCurrent() { return bossHpCurrent; }
    public void setBossHpCurrent(int bossHpCurrent) { this.bossHpCurrent = bossHpCurrent; }

    public int getMoveBudget() { return moveBudget; }
    public void setMoveBudget(int moveBudget) { this.moveBudget = moveBudget; }

    public int getMovesUsed() { return movesUsed; }
    public void setMovesUsed(int movesUsed) { this.movesUsed = movesUsed; }

    public PveEncounterStatus getStatus() { return status; }
    public void setStatus(PveEncounterStatus status) { this.status = status; }

    public Instant getClearedAt() { return clearedAt; }
    public void setClearedAt(Instant clearedAt) { this.clearedAt = clearedAt; }

    public Instant getFailedAt() { return failedAt; }
    public void setFailedAt(Instant failedAt) { this.failedAt = failedAt; }
}
