package com.gomoku.repository;

import com.gomoku.domain.entity.PveEncounterEvent;
import com.gomoku.domain.enums.PveEncounterEventType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PveEncounterEventRepository extends JpaRepository<PveEncounterEvent, String> {
    List<PveEncounterEvent> findByEncounterIdOrderByOccurredAtAscIdAsc(String encounterId);
    List<PveEncounterEvent> findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(String encounterId, PveEncounterEventType eventType);
    boolean existsByEncounterIdAndEventTypeAndMoveNumber(String encounterId, PveEncounterEventType eventType, Integer moveNumber);
}
