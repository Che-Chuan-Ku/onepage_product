package com.gomoku.repository;

import com.gomoku.domain.entity.PveFieldCell;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PveFieldCellRepository extends JpaRepository<PveFieldCell, String> {
    List<PveFieldCell> findByEncounterIdAndDeletedFalse(String encounterId);
}
