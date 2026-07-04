package com.gomoku.domain.entity;

import com.gomoku.domain.enums.BattleMode;
import com.gomoku.domain.enums.FieldType;
import com.gomoku.domain.enums.RoomStatus;
import com.gomoku.domain.enums.RoomVisibility;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "game_rooms")
public class GameRoom extends BaseEntity {

    @Column(name = "room_code", length = 12, nullable = false)
    private String roomCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 20)
    private RoomVisibility visibility;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private RoomStatus status = RoomStatus.WAITING;

    @Column(name = "is_swap2_mode", nullable = false)
    private boolean swap2Mode = false;

    /** 普通 / 真劍勝負 (req #34); SERIOUS_DUEL is mutually exclusive with swap2Mode (Q9). */
    @Enumerated(EnumType.STRING)
    @Column(name = "battle_mode", nullable = false, length = 20)
    private BattleMode battleMode = BattleMode.NORMAL;

    /** Required when battleMode=SERIOUS_DUEL, must be null otherwise (req #34). */
    @Enumerated(EnumType.STRING)
    @Column(name = "field_type", length = 20)
    private FieldType fieldType;

    @Column(name = "host_player_id", length = 36, nullable = false)
    private String hostPlayerId;

    @Column(name = "guest_player_id", length = 36)
    private String guestPlayerId;

    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }

    public RoomVisibility getVisibility() { return visibility; }
    public void setVisibility(RoomVisibility visibility) { this.visibility = visibility; }

    public RoomStatus getStatus() { return status; }
    public void setStatus(RoomStatus status) { this.status = status; }

    public boolean isSwap2Mode() { return swap2Mode; }
    public void setSwap2Mode(boolean swap2Mode) { this.swap2Mode = swap2Mode; }

    public BattleMode getBattleMode() { return battleMode; }
    public void setBattleMode(BattleMode battleMode) { this.battleMode = battleMode; }

    public FieldType getFieldType() { return fieldType; }
    public void setFieldType(FieldType fieldType) { this.fieldType = fieldType; }

    public String getHostPlayerId() { return hostPlayerId; }
    public void setHostPlayerId(String hostPlayerId) { this.hostPlayerId = hostPlayerId; }

    public String getGuestPlayerId() { return guestPlayerId; }
    public void setGuestPlayerId(String guestPlayerId) { this.guestPlayerId = guestPlayerId; }
}
