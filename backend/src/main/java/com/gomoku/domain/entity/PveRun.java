package com.gomoku.domain.entity;

import com.gomoku.domain.enums.ClassType;
import com.gomoku.domain.enums.PveRunStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One PVE challenge run: 8 encounters in fixed order (FR-C1), gold economy
 * (FR-C3), single in-progress run per player (FR-C8). gold_earned/gold_spent
 * are additive beyond erm.dbml — FR-C7 settlement needs the totals and they
 * are not consistently derivable from encounter/shop rows.
 */
@Entity
@Table(name = "pve_runs")
public class PveRun extends BaseEntity {

    @Column(name = "player_id", length = 36, nullable = false)
    private String playerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "class_type", length = 20, nullable = false)
    private ClassType classType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private PveRunStatus status = PveRunStatus.IN_PROGRESS;

    @Column(name = "seed", length = 64, nullable = false)
    private String seed;

    @Column(name = "gold", nullable = false)
    private int gold = 0;

    @Column(name = "current_encounter_sequence", nullable = false)
    private int currentEncounterSequence = 1;

    @Column(name = "reached_encounter_sequence", nullable = false)
    private int reachedEncounterSequence = 0;

    @Column(name = "total_damage_dealt", nullable = false)
    private long totalDamageDealt = 0;

    @Column(name = "metronome_multiplier_bonus", nullable = false, precision = 6, scale = 2)
    private BigDecimal metronomeMultiplierBonus = BigDecimal.ZERO;

    @Column(name = "gold_earned", nullable = false)
    private int goldEarned = 0;

    @Column(name = "gold_spent", nullable = false)
    private int goldSpent = 0;

    @Column(name = "ended_at")
    private Instant endedAt;

    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }

    public ClassType getClassType() { return classType; }
    public void setClassType(ClassType classType) { this.classType = classType; }

    public PveRunStatus getStatus() { return status; }
    public void setStatus(PveRunStatus status) { this.status = status; }

    public String getSeed() { return seed; }
    public void setSeed(String seed) { this.seed = seed; }

    public int getGold() { return gold; }
    public void setGold(int gold) { this.gold = gold; }

    public int getCurrentEncounterSequence() { return currentEncounterSequence; }
    public void setCurrentEncounterSequence(int currentEncounterSequence) { this.currentEncounterSequence = currentEncounterSequence; }

    public int getReachedEncounterSequence() { return reachedEncounterSequence; }
    public void setReachedEncounterSequence(int reachedEncounterSequence) { this.reachedEncounterSequence = reachedEncounterSequence; }

    public long getTotalDamageDealt() { return totalDamageDealt; }
    public void setTotalDamageDealt(long totalDamageDealt) { this.totalDamageDealt = totalDamageDealt; }

    public BigDecimal getMetronomeMultiplierBonus() { return metronomeMultiplierBonus; }
    public void setMetronomeMultiplierBonus(BigDecimal metronomeMultiplierBonus) { this.metronomeMultiplierBonus = metronomeMultiplierBonus; }

    public int getGoldEarned() { return goldEarned; }
    public void setGoldEarned(int goldEarned) { this.goldEarned = goldEarned; }

    public int getGoldSpent() { return goldSpent; }
    public void setGoldSpent(int goldSpent) { this.goldSpent = goldSpent; }

    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
}
