package com.gomoku.repository;

import com.gomoku.domain.entity.GameRoom;
import com.gomoku.domain.enums.RoomStatus;
import com.gomoku.domain.enums.RoomVisibility;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
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

    /** Bug fix: excludes stale WAITING rooms past their TTL (see RoomService). */
    List<GameRoom> findByVisibilityAndStatusAndDeletedFalseAndUpdatedAtAfterOrderByCreatedAtDesc(
            RoomVisibility visibility, RoomStatus status, Instant updatedAfter, Pageable pageable);

    long countByVisibilityAndStatusAndDeletedFalseAndUpdatedAtAfter(
            RoomVisibility visibility, RoomStatus status, Instant updatedAfter);

    Optional<GameRoom> findFirstByVisibilityAndStatusAndDeletedFalseOrderByCreatedAtAsc(
            RoomVisibility visibility, RoomStatus status);

    /**
     * Bug fix (room TTL): rooms stuck WAITING (abandoned lobby, no Ready reached)
     * or FINISHED (game ended, see GameService#closeRoomIfOnline) past their
     * respective cutoffs — swept periodically by RoomService#sweepExpiredRooms.
     */
    @Query("select r from GameRoom r where r.deleted = false and ("
            + "(r.status = com.gomoku.domain.enums.RoomStatus.WAITING and r.updatedAt < :waitingCutoff) or "
            + "(r.status = com.gomoku.domain.enums.RoomStatus.FINISHED and r.updatedAt < :finishedCutoff))")
    List<GameRoom> findExpiredRooms(Instant waitingCutoff, Instant finishedCutoff);
}
