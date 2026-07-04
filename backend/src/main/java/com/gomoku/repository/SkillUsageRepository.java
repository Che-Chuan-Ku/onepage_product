package com.gomoku.repository;

import com.gomoku.domain.entity.SkillUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SkillUsageRepository extends JpaRepository<SkillUsage, String> {
    List<SkillUsage> findByGameIdAndPlayerId(String gameId, String playerId);
    boolean existsByGameIdAndPlayerIdAndSkillType(String gameId, String playerId,
                                                  com.gomoku.domain.enums.SkillType skillType);
    // Used to restore per-player used-skill state on reconnect/page-reload (R2-3).
    List<SkillUsage> findByGameIdOrderByUsedAtAsc(String gameId);
}
