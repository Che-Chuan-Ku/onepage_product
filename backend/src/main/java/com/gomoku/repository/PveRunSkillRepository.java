package com.gomoku.repository;

import com.gomoku.domain.entity.PveRunSkill;
import com.gomoku.domain.enums.SkillType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PveRunSkillRepository extends JpaRepository<PveRunSkill, String> {
    List<PveRunSkill> findByRunIdAndDeletedFalse(String runId);
    Optional<PveRunSkill> findByRunIdAndSkillTypeAndDeletedFalse(String runId, SkillType skillType);
}
