package com.gomoku.repository;

import com.gomoku.domain.entity.Player;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlayerRepository extends JpaRepository<Player, String> {
    Optional<Player> findByUsernameAndDeletedFalse(String username);
    boolean existsByUsernameAndDeletedFalse(String username);
    boolean existsByEmailAndDeletedFalse(String email);
    Optional<Player> findByIdAndDeletedFalse(String id);
}
