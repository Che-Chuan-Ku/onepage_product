package com.gomoku.repository;

import com.gomoku.domain.entity.OpeningStone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OpeningStoneRepository extends JpaRepository<OpeningStone, String> {
    List<OpeningStone> findByGameIdOrderBySequenceAsc(String gameId);
    Optional<OpeningStone> findFirstByGameIdOrderBySequenceDesc(String gameId);
    boolean existsByGameIdAndRowAndCol(String gameId, int row, int col);
    long countByGameId(String gameId);
}
