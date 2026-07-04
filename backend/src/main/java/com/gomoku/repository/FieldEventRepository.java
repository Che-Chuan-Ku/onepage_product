package com.gomoku.repository;

import com.gomoku.domain.entity.FieldEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FieldEventRepository extends JpaRepository<FieldEvent, String> {
    List<FieldEvent> findByGameIdOrderByOccurredAtAscIdAsc(String gameId);
}
