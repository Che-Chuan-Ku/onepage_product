package com.gomoku.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "room_chat_messages")
public class RoomChatMessage extends BaseEntity {

    @Column(name = "room_id", length = 36, nullable = false)
    private String roomId;

    @Column(name = "player_id", length = 36, nullable = false)
    private String playerId;

    @Column(name = "content", length = 500, nullable = false)
    private String content;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
