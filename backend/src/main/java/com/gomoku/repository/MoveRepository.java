package com.gomoku.repository;

import com.gomoku.domain.entity.Move;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MoveRepository extends JpaRepository<Move, String> {
    List<Move> findByGameIdOrderByMoveNumberAsc(String gameId);
    boolean existsByGameIdAndRowAndCol(String gameId, int row, int col);
}
