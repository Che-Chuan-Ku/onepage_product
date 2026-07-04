package com.gomoku.repository;

import com.gomoku.domain.entity.FieldCell;
import com.gomoku.domain.enums.FieldCellKind;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FieldCellRepository extends JpaRepository<FieldCell, String> {
    List<FieldCell> findByGameIdAndDeletedFalse(String gameId);
    List<FieldCell> findByGameIdAndCellKindAndDeletedFalse(String gameId, FieldCellKind cellKind);
    Optional<FieldCell> findByGameIdAndRowAndColAndDeletedFalse(String gameId, int row, int col);
}
