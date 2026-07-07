package com.gomoku.repository;

import com.gomoku.domain.entity.PveFieldState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PveFieldStateRepository extends JpaRepository<PveFieldState, String> {
    Optional<PveFieldState> findByEncounterIdAndDeletedFalse(String encounterId);
}
