package com.gomoku.domain.entity;

import com.gomoku.domain.enums.PveShopVisitStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

/** Shop opened after each cleared encounter except the 8th (FR-C4). */
@Entity
@Table(name = "pve_shop_visits")
public class PveShopVisit extends BaseEntity {

    @Column(name = "run_id", length = 36, nullable = false)
    private String runId;

    @Column(name = "after_encounter_sequence", nullable = false)
    private int afterEncounterSequence;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private PveShopVisitStatus status = PveShopVisitStatus.OPEN;

    @Column(name = "reroll_count", nullable = false)
    private int rerollCount = 0;

    @Column(name = "opened_at", nullable = false)
    private Instant openedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public int getAfterEncounterSequence() { return afterEncounterSequence; }
    public void setAfterEncounterSequence(int afterEncounterSequence) { this.afterEncounterSequence = afterEncounterSequence; }

    public PveShopVisitStatus getStatus() { return status; }
    public void setStatus(PveShopVisitStatus status) { this.status = status; }

    public int getRerollCount() { return rerollCount; }
    public void setRerollCount(int rerollCount) { this.rerollCount = rerollCount; }

    public Instant getOpenedAt() { return openedAt; }
    public void setOpenedAt(Instant openedAt) { this.openedAt = openedAt; }

    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
}
