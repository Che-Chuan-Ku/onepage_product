package com.gomoku.repository;

import com.gomoku.domain.entity.PlayerStats;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PlayerStatsRepository extends JpaRepository<PlayerStats, String> {

    Optional<PlayerStats> findByPlayerIdAndDeletedFalse(String playerId);

    /**
     * Leaderboard (Q2): only players with wins+losses >= 10; order by
     * wins DESC then win_rate DESC.
     */
    @Query("select s from PlayerStats s where s.deleted = false "
            + "and (s.wins + s.losses) >= 10 "
            + "order by s.wins desc, s.winRate desc")
    List<PlayerStats> findLeaderboard(Pageable pageable);

    @Query("select count(s) from PlayerStats s where s.deleted = false "
            + "and (s.wins + s.losses) >= 10")
    long countLeaderboard();
}
