package com.gomoku.repository;

import com.gomoku.domain.entity.Game;
import com.gomoku.domain.enums.GameStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GameRepository extends JpaRepository<Game, String> {

    Optional<Game> findByIdAndDeletedFalse(String id);

    /** Idempotency for room→game: an active (non-finished) game already bound to this room. */
    Optional<Game> findFirstByRoomIdAndStatusNotAndDeletedFalse(String roomId, GameStatus status);

    List<Game> findTop10ByWinnerPlayerIdAndDeletedFalseOrderByEndedAtDesc(String winnerPlayerId);

    @org.springframework.data.jpa.repository.Query(
            "select g from Game g where g.deleted = false and g.status = com.gomoku.domain.enums.GameStatus.FINISHED "
            + "and (g.blackPlayerId = :playerId or g.whitePlayerId = :playerId) order by g.endedAt desc")
    List<Game> findRecentFinishedByPlayer(String playerId, org.springframework.data.domain.Pageable pageable);
}
