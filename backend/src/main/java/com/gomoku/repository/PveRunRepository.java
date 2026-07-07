package com.gomoku.repository;

import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.enums.PveRunStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PveRunRepository extends JpaRepository<PveRun, String> {
    Optional<PveRun> findFirstByPlayerIdAndStatusAndDeletedFalse(String playerId, PveRunStatus status);
    boolean existsByPlayerIdAndStatusAndDeletedFalse(String playerId, PveRunStatus status);
}
