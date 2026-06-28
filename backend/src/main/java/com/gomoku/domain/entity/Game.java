package com.gomoku.domain.entity;

import com.gomoku.domain.enums.CoinResult;
import com.gomoku.domain.enums.GameMode;
import com.gomoku.domain.enums.GameResult;
import com.gomoku.domain.enums.GameStatus;
import com.gomoku.domain.enums.OpeningType;
import com.gomoku.domain.enums.StoneColor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "games")
public class Game extends BaseEntity {

    @Column(name = "room_id", length = 36)
    private String roomId;

    @Enumerated(EnumType.STRING)
    @Column(name = "game_mode", nullable = false, length = 20)
    private GameMode gameMode;

    @Enumerated(EnumType.STRING)
    @Column(name = "opening_type", nullable = false, length = 20)
    private OpeningType openingType = OpeningType.STANDARD;

    @Column(name = "use_swap2", nullable = false)
    private boolean useSwap2 = false;

    /** Swap2: tentative-second chose PLACE_TWO_MORE — needed to derive
     *  PLACING_SECOND_TWO at 3 placed stones (the choice itself adds no stone). */
    @Column(name = "swap2_two_more_chosen", nullable = false)
    private boolean swap2TwoMoreChosen = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private GameStatus status = GameStatus.PLAYING;

    @Column(name = "black_player_id", length = 36)
    private String blackPlayerId;

    @Column(name = "white_player_id", length = 36)
    private String whitePlayerId;

    @Column(name = "tentative_first_player_id", length = 36)
    private String tentativeFirstPlayerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "coin_result", length = 10)
    private CoinResult coinResult;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_turn", length = 10)
    private StoneColor currentTurn;

    @Enumerated(EnumType.STRING)
    @Column(name = "result", length = 20)
    private GameResult result;

    @Column(name = "winner_player_id", length = 36)
    private String winnerPlayerId;

    @Column(name = "move_count", nullable = false)
    private int moveCount = 0;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "ended_at")
    private Instant endedAt;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public GameMode getGameMode() { return gameMode; }
    public void setGameMode(GameMode gameMode) { this.gameMode = gameMode; }

    public OpeningType getOpeningType() { return openingType; }
    public void setOpeningType(OpeningType openingType) { this.openingType = openingType; }

    public boolean isUseSwap2() { return useSwap2; }
    public void setUseSwap2(boolean useSwap2) { this.useSwap2 = useSwap2; }

    public boolean isSwap2TwoMoreChosen() { return swap2TwoMoreChosen; }
    public void setSwap2TwoMoreChosen(boolean swap2TwoMoreChosen) { this.swap2TwoMoreChosen = swap2TwoMoreChosen; }

    public GameStatus getStatus() { return status; }
    public void setStatus(GameStatus status) { this.status = status; }

    public String getBlackPlayerId() { return blackPlayerId; }
    public void setBlackPlayerId(String blackPlayerId) { this.blackPlayerId = blackPlayerId; }

    public String getWhitePlayerId() { return whitePlayerId; }
    public void setWhitePlayerId(String whitePlayerId) { this.whitePlayerId = whitePlayerId; }

    public String getTentativeFirstPlayerId() { return tentativeFirstPlayerId; }
    public void setTentativeFirstPlayerId(String tentativeFirstPlayerId) { this.tentativeFirstPlayerId = tentativeFirstPlayerId; }

    public CoinResult getCoinResult() { return coinResult; }
    public void setCoinResult(CoinResult coinResult) { this.coinResult = coinResult; }

    public StoneColor getCurrentTurn() { return currentTurn; }
    public void setCurrentTurn(StoneColor currentTurn) { this.currentTurn = currentTurn; }

    public GameResult getResult() { return result; }
    public void setResult(GameResult result) { this.result = result; }

    public String getWinnerPlayerId() { return winnerPlayerId; }
    public void setWinnerPlayerId(String winnerPlayerId) { this.winnerPlayerId = winnerPlayerId; }

    public int getMoveCount() { return moveCount; }
    public void setMoveCount(int moveCount) { this.moveCount = moveCount; }

    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }

    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
}
