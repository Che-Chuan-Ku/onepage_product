package com.gomoku.repository;

import com.gomoku.domain.entity.PveRunRelic;
import com.gomoku.domain.enums.PveRelicType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PveRunRelicRepository extends JpaRepository<PveRunRelic, String> {
    List<PveRunRelic> findByRunIdAndDeletedFalse(String runId);
    boolean existsByRunIdAndRelicTypeAndDeletedFalse(String runId, PveRelicType relicType);
}
