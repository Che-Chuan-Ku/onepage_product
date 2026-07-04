package com.gomoku.repository;

import com.gomoku.domain.entity.FieldState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FieldStateRepository extends JpaRepository<FieldState, String> {
    Optional<FieldState> findByGameIdAndDeletedFalse(String gameId);
}
