package com.gomoku.domain.entity;

import com.gomoku.domain.enums.PveRelicType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

/** Held relic, unique per run, capped at 5 by the service layer (FR-C4 FR-C5). */
@Entity
@Table(name = "pve_run_relics")
public class PveRunRelic extends BaseEntity {

    @Column(name = "run_id", length = 36, nullable = false)
    private String runId;

    @Enumerated(EnumType.STRING)
    @Column(name = "relic_type", length = 30, nullable = false)
    private PveRelicType relicType;

    @Column(name = "acquired_at", nullable = false)
    private Instant acquiredAt;

    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public PveRelicType getRelicType() { return relicType; }
    public void setRelicType(PveRelicType relicType) { this.relicType = relicType; }

    public Instant getAcquiredAt() { return acquiredAt; }
    public void setAcquiredAt(Instant acquiredAt) { this.acquiredAt = acquiredAt; }
}
