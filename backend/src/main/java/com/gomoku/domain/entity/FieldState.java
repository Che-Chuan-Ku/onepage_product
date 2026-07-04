package com.gomoku.domain.entity;

import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.FieldType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Serious Duel per-game field state (req #40 #41 #46): beach erosion progress
 * and wave round counter; restored on reconnect together with game state.
 */
@Entity
@Table(name = "field_states")
public class FieldState extends BaseEntity {

    @Column(name = "game_id", length = 36, nullable = false)
    private String gameId;

    @Enumerated(EnumType.STRING)
    @Column(name = "field_type", nullable = false, length = 20)
    private FieldType fieldType;

    @Enumerated(EnumType.STRING)
    @Column(name = "sea_side", length = 10)
    private BoardSide seaSide;

    @Column(name = "eroded_rows", nullable = false)
    private int erodedRows = 0;

    @Column(name = "tide_triggered", nullable = false)
    private boolean tideTriggered = false;

    /** Hands played since last wave; a wave surges every 10 hands (5 rounds, Q7). */
    @Column(name = "round_counter", nullable = false)
    private int roundCounter = 0;

    public String getGameId() { return gameId; }
    public void setGameId(String gameId) { this.gameId = gameId; }

    public FieldType getFieldType() { return fieldType; }
    public void setFieldType(FieldType fieldType) { this.fieldType = fieldType; }

    public BoardSide getSeaSide() { return seaSide; }
    public void setSeaSide(BoardSide seaSide) { this.seaSide = seaSide; }

    public int getErodedRows() { return erodedRows; }
    public void setErodedRows(int erodedRows) { this.erodedRows = erodedRows; }

    public boolean isTideTriggered() { return tideTriggered; }
    public void setTideTriggered(boolean tideTriggered) { this.tideTriggered = tideTriggered; }

    public int getRoundCounter() { return roundCounter; }
    public void setRoundCounter(int roundCounter) { this.roundCounter = roundCounter; }
}
