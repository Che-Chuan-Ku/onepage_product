package com.gomoku.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "player_stats")
public class PlayerStats extends BaseEntity {

    @Column(name = "player_id", length = 36, nullable = false)
    private String playerId;

    @Column(name = "wins", nullable = false)
    private int wins = 0;

    @Column(name = "losses", nullable = false)
    private int losses = 0;

    @Column(name = "draws", nullable = false)
    private int draws = 0;

    @Column(name = "win_rate", nullable = false, precision = 19, scale = 4)
    private BigDecimal winRate = BigDecimal.ZERO;

    /** Recompute cached win_rate = wins / (wins + losses); 0 when no decisive games. */
    public void recomputeWinRate() {
        int decisive = wins + losses;
        if (decisive == 0) {
            this.winRate = BigDecimal.ZERO;
        } else {
            this.winRate = BigDecimal.valueOf(wins)
                    .divide(BigDecimal.valueOf(decisive), 4, java.math.RoundingMode.HALF_UP);
        }
    }

    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }

    public int getWins() { return wins; }
    public void setWins(int wins) { this.wins = wins; }

    public int getLosses() { return losses; }
    public void setLosses(int losses) { this.losses = losses; }

    public int getDraws() { return draws; }
    public void setDraws(int draws) { this.draws = draws; }

    public BigDecimal getWinRate() { return winRate; }
    public void setWinRate(BigDecimal winRate) { this.winRate = winRate; }
}
