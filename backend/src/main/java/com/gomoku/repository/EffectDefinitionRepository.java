package com.gomoku.repository;

import com.gomoku.domain.entity.EffectDefinition;
import com.gomoku.domain.enums.BattleContext;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EffectDefinitionRepository extends JpaRepository<EffectDefinition, String> {
    Optional<EffectDefinition> findByEffectKeyAndApplicableModeAndDeletedFalse(String effectKey, BattleContext applicableMode);
}
