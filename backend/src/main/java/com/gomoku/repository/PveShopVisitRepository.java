package com.gomoku.repository;

import com.gomoku.domain.entity.PveShopVisit;
import com.gomoku.domain.enums.PveShopVisitStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PveShopVisitRepository extends JpaRepository<PveShopVisit, String> {
    Optional<PveShopVisit> findFirstByRunIdAndStatusAndDeletedFalseOrderByAfterEncounterSequenceDesc(String runId, PveShopVisitStatus status);
    Optional<PveShopVisit> findByRunIdAndAfterEncounterSequenceAndDeletedFalse(String runId, int afterEncounterSequence);
}
