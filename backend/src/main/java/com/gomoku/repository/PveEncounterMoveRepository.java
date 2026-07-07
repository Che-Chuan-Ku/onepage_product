package com.gomoku.repository;

import com.gomoku.domain.entity.PveEncounterMove;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PveEncounterMoveRepository extends JpaRepository<PveEncounterMove, String> {
    List<PveEncounterMove> findByEncounterIdOrderByEncounterMoveNumberAsc(String encounterId);
    long countByEncounterId(String encounterId);
}
