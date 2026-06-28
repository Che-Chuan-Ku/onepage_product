package com.gomoku.domain.entity;

import com.gomoku.domain.enums.RoomMemberRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "room_members")
public class RoomMember extends BaseEntity {

    @Column(name = "room_id", length = 36, nullable = false)
    private String roomId;

    @Column(name = "player_id", length = 36, nullable = false)
    private String playerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private RoomMemberRole role = RoomMemberRole.PLAYER;

    @Column(name = "is_ready", nullable = false)
    private boolean ready = false;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }

    public RoomMemberRole getRole() { return role; }
    public void setRole(RoomMemberRole role) { this.role = role; }

    public boolean isReady() { return ready; }
    public void setReady(boolean ready) { this.ready = ready; }
}
