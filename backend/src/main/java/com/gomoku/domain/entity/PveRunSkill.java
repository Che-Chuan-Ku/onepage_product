package com.gomoku.domain.entity;

import com.gomoku.domain.enums.SkillType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Held consumable skill with quantity (FR-B5 FR-C4). Total quantity per run
 * is capped at 3 by the service layer.
 */
@Entity
@Table(name = "pve_run_skills")
public class PveRunSkill extends BaseEntity {

    @Column(name = "run_id", length = 36, nullable = false)
    private String runId;

    @Enumerated(EnumType.STRING)
    @Column(name = "skill_type", length = 30, nullable = false)
    private SkillType skillType;

    @Column(name = "quantity", nullable = false)
    private int quantity = 1;

    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public SkillType getSkillType() { return skillType; }
    public void setSkillType(SkillType skillType) { this.skillType = skillType; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
}
