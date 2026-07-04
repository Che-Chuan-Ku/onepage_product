package com.gomoku.service;

import com.gomoku.domain.entity.Game;
import com.gomoku.domain.entity.PlayerStats;
import com.gomoku.domain.enums.GameMode;
import com.gomoku.domain.enums.GameResult;
import com.gomoku.repository.PlayerStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * PlayerStats updates after a finished game — shared by the normal-mode path
 * (GameService) and the Serious Duel settlement (SeriousDuelService).
 * Only ONLINE games with both players assigned count.
 */
@Service
public class StatsService {

    private final PlayerStatsRepository playerStatsRepository;

    public StatsService(PlayerStatsRepository playerStatsRepository) {
        this.playerStatsRepository = playerStatsRepository;
    }

    @Transactional
    public void updateStats(Game game, GameResult result) {
        if (game.getGameMode() != GameMode.ONLINE) {
            return;
        }
        String blackId = game.getBlackPlayerId();
        String whiteId = game.getWhitePlayerId();
        if (blackId == null || whiteId == null) {
            return;
        }

        PlayerStats blackStats = playerStatsRepository.findByPlayerIdAndDeletedFalse(blackId).orElse(null);
        PlayerStats whiteStats = playerStatsRepository.findByPlayerIdAndDeletedFalse(whiteId).orElse(null);

        switch (result) {
            case BLACK_WIN -> {
                addWin(blackStats);
                addLoss(whiteStats);
            }
            case WHITE_WIN -> {
                addWin(whiteStats);
                addLoss(blackStats);
            }
            case DRAW -> {
                addDraw(blackStats);
                addDraw(whiteStats);
            }
        }
    }

    private void addWin(PlayerStats stats) {
        if (stats != null) {
            stats.setWins(stats.getWins() + 1);
            stats.recomputeWinRate();
            playerStatsRepository.save(stats);
        }
    }

    private void addLoss(PlayerStats stats) {
        if (stats != null) {
            stats.setLosses(stats.getLosses() + 1);
            stats.recomputeWinRate();
            playerStatsRepository.save(stats);
        }
    }

    private void addDraw(PlayerStats stats) {
        if (stats != null) {
            stats.setDraws(stats.getDraws() + 1);
            playerStatsRepository.save(stats);
        }
    }
}
