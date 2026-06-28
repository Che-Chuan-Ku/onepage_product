package com.gomoku.repository;

import com.gomoku.domain.entity.RoomChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomChatMessageRepository extends JpaRepository<RoomChatMessage, String> {
    List<RoomChatMessage> findByRoomIdAndDeletedFalseOrderByCreatedAtAsc(String roomId);
}
