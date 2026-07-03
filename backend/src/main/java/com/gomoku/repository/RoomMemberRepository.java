package com.gomoku.repository;

import com.gomoku.domain.entity.RoomMember;
import com.gomoku.domain.enums.RoomMemberRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomMemberRepository extends JpaRepository<RoomMember, String> {

    // Ordered by join time (createdAt) ascending so the host — the first PLAYER
    // to join — is always first in the list. Frontend room/game pages rely on
    // this stable order to map slot 0/1 to black/white without extra lookups.
    List<RoomMember> findByRoomIdAndDeletedFalseOrderByCreatedAtAsc(String roomId);

    Optional<RoomMember> findByRoomIdAndPlayerIdAndDeletedFalse(String roomId, String playerId);

    long countByRoomIdAndRoleAndDeletedFalse(String roomId, RoomMemberRole role);

    List<RoomMember> findByRoomIdAndRoleAndDeletedFalseOrderByCreatedAtAsc(String roomId, RoomMemberRole role);
}
