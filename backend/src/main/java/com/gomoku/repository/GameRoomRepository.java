package com.gomoku.repository;

import com.gomoku.domain.entity.GameRoom;
import com.gomoku.domain.enums.RoomStatus;
import com.gomoku.domain.enums.RoomVisibility;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface GameRoomRepository extends JpaRepository<GameRoom, String> {

    Optional<GameRoom> findByIdAndDeletedFalse(String id);

    /** Pessimistic row lock — serializes concurrent start-game on the same room. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from GameRoom r where r.id = :id and r.deleted = false")
    Optional<GameRoom> findByIdForUpdate(String id);

    Optional<GameRoom> findByRoomCodeAndDeletedFalse(String roomCode);

    boolean existsByRoomCodeAndDeletedFalse(String roomCode);

    List<GameRoom> findByVisibilityAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            RoomVisibility visibility, RoomStatus status, Pageable pageable);

    long countByVisibilityAndStatusAndDeletedFalse(RoomVisibility visibility, RoomStatus status);

    Optional<GameRoom> findFirstByVisibilityAndStatusAndDeletedFalseOrderByCreatedAtAsc(
            RoomVisibility visibility, RoomStatus status);
}
