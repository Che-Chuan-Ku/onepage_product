package com.gomoku.repository;

import com.gomoku.domain.entity.PveEncounter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PveEncounterRepository extends JpaRepository<PveEncounter, String> {
    Optional<PveEncounter> findByRunIdAndSequenceAndDeletedFalse(String runId, int sequence);
    List<PveEncounter> findByRunIdAndDeletedFalseOrderBySequenceAsc(String runId);
}
