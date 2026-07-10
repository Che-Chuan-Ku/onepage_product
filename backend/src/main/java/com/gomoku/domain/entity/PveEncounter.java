package com.gomoku.domain.entity;

import com.gomoku.domain.enums.PveEncounterStatus;
import com.gomoku.domain.enums.PveEncounterType;
import com.gomoku.domain.enums.PveFieldType;
import com.gomoku.domain.enums.PveMinorDisruptionType;
import com.gomoku.domain.enums.PveMutationType;
import com.gomoku.domain.enums.PveOpeningScript;
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

    /** DUEL only (2026-07-09 §1.5/§6.5 公平性修正): set when moves are exhausted with no winner (status DRAW). */
    @Column(name = "drawn_at")
    private Instant drawnAt;

    /**
     * DUEL only (2026-07-09 §1.5/§6.5 公平性修正): 1-based retry ordinal for
     * this (run, sequence) — incremented every time a DRAWn duel encounter is
     * retried via {@code retryDuelEncounter}, and mixed into the boss-AI RNG
     * seed so each retry gets an independent random stream instead of
     * deterministically replaying the exact same draw (see
     * {@code PveChallengeService#duelRunSeed}). Always 1 for PUZZLE encounters
     * and for a DUEL encounter's very first attempt.
     */
    @Column(name = "attempt_number", nullable = false)
    private int attemptNumber = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "minor_disruption_type", length = 20, nullable = false)
    private PveMinorDisruptionType minorDisruptionType = PveMinorDisruptionType.NONE;

    @Column(name = "minor_disruption_triggered", nullable = false)
    private boolean minorDisruptionTriggered = false;

    /** 2026-07-09 魔王對弈設計 §1.0/§5.1: PUZZLE (default, sequences 1/2/3/5/6/7) vs DUEL (4/8). */
    @Enumerated(EnumType.STRING)
    @Column(name = "encounter_type", length = 10, nullable = false)
    private PveEncounterType encounterType = PveEncounterType.PUZZLE;

    /** DUEL only (§1.4); NONE for every PUZZLE encounter. */
    @Enumerated(EnumType.STRING)
    @Column(name = "opening_script", length = 10, nullable = false)
    private PveOpeningScript openingScript = PveOpeningScript.NONE;

    // ── L8 "SKILL_DEMON" 一次性技能 charge 旗標（documents/PVE-全對弈階梯設計-
    // 2026-07-10.md §3.2/§9.1; migration V7）：三者只在 sequence=8 有意義，
    // 其餘關卡恆為 false。

    @Column(name = "boss_pioneer_used", nullable = false)
    private boolean bossPioneerUsed = false;

    @Column(name = "boss_sniper_used", nullable = false)
    private boolean bossSniperUsed = false;

    @Column(name = "boss_scatter_used", nullable = false)
    private boolean bossScatterUsed = false;

    public boolean isBossPioneerUsed() { return bossPioneerUsed; }
    public void setBossPioneerUsed(boolean bossPioneerUsed) { this.bossPioneerUsed = bossPioneerUsed; }

    public boolean isBossSniperUsed() { return bossSniperUsed; }
    public void setBossSniperUsed(boolean bossSniperUsed) { this.bossSniperUsed = bossSniperUsed; }

    public boolean isBossScatterUsed() { return bossScatterUsed; }
    public void setBossScatterUsed(boolean bossScatterUsed) { this.bossScatterUsed = bossScatterUsed; }

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

    public Instant getDrawnAt() { return drawnAt; }
    public void setDrawnAt(Instant drawnAt) { this.drawnAt = drawnAt; }

    public int getAttemptNumber() { return attemptNumber; }
    public void setAttemptNumber(int attemptNumber) { this.attemptNumber = attemptNumber; }

    public PveMinorDisruptionType getMinorDisruptionType() { return minorDisruptionType; }
    public void setMinorDisruptionType(PveMinorDisruptionType minorDisruptionType) { this.minorDisruptionType = minorDisruptionType; }

    public boolean isMinorDisruptionTriggered() { return minorDisruptionTriggered; }
    public void setMinorDisruptionTriggered(boolean minorDisruptionTriggered) { this.minorDisruptionTriggered = minorDisruptionTriggered; }

    public PveEncounterType getEncounterType() { return encounterType; }
    public void setEncounterType(PveEncounterType encounterType) { this.encounterType = encounterType; }

    public PveOpeningScript getOpeningScript() { return openingScript; }
    public void setOpeningScript(PveOpeningScript openingScript) { this.openingScript = openingScript; }
}
