package com.gomoku.repository;

import com.gomoku.domain.entity.RoomMember;
import com.gomoku.domain.enums.RoomMemberRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomMemberRepository extends JpaRepository<RoomMember, String> {

    List<RoomMember> findByRoomIdAndDeletedFalse(String roomId);

    Optional<RoomMember> findByRoomIdAndPlayerIdAndDeletedFalse(String roomId, String playerId);

    long countByRoomIdAndRoleAndDeletedFalse(String roomId, RoomMemberRole role);

    List<RoomMember> findByRoomIdAndRoleAndDeletedFalse(String roomId, RoomMemberRole role);
}
