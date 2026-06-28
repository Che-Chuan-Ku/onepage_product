package com.gomoku.service;

import com.gomoku.domain.entity.Game;
import com.gomoku.domain.entity.Player;
import com.gomoku.domain.entity.PlayerStats;
import com.gomoku.dto.response.LeaderboardEntryResponse;
import com.gomoku.dto.response.PlayerStatsResponse;
import com.gomoku.dto.response.RecentGameItem;
import com.gomoku.exception.BusinessException;
import com.gomoku.exception.ErrorCode;
import com.gomoku.repository.GameRepository;
import com.gomoku.repository.PlayerRepository;
import com.gomoku.repository.PlayerStatsRepository;
import com.gomoku.web.PageData;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class PlayerService {

    private final PlayerRepository playerRepository;
    private final PlayerStatsRepository playerStatsRepository;
    private final GameRepository gameRepository;

    public PlayerService(PlayerRepository playerRepository,
                         PlayerStatsRepository playerStatsRepository,
                         GameRepository gameRepository) {
        this.playerRepository = playerRepository;
        this.playerStatsRepository = playerStatsRepository;
        this.gameRepository = gameRepository;
    }

    @Transactional(readOnly = true)
    public PlayerStatsResponse getStats(String playerId) {
        PlayerStats stats = playerStatsRepository.findByPlayerIdAndDeletedFalse(playerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "玩家戰績不存在"));

        List<Game> recent = gameRepository.findRecentFinishedByPlayer(playerId, PageRequest.of(0, 10));
        List<RecentGameItem> recentItems = new ArrayList<>();
        for (Game g : recent) {
            recentItems.add(new RecentGameItem(
                    g.getId(),
                    g.getResult() == null ? null : g.getResult().name(),
                    g.getEndedAt() == null ? null : g.getEndedAt().toString()));
        }

        return new PlayerStatsResponse(
                playerId,
                stats.getWins(),
                stats.getLosses(),
                stats.getDraws(),
                stats.getWinRate().doubleValue(),
                recentItems);
    }

    /**
     * Leaderboard (Q2): wins DESC, winRate DESC; threshold wins+losses >= 10.
     */
    @Transactional(readOnly = true)
    public PageData<LeaderboardEntryResponse> getLeaderboard(int skip, int top) {
        int page = top <= 0 ? 0 : skip / top;
        List<PlayerStats> rows = playerStatsRepository.findLeaderboard(PageRequest.of(page, Math.max(top, 1)));
        long total = playerStatsRepository.countLeaderboard();

        List<LeaderboardEntryResponse> items = new ArrayList<>();
        int rank = skip + 1;
        for (PlayerStats s : rows) {
            Player p = playerRepository.findById(s.getPlayerId()).orElse(null);
            String username = p != null
                    ? (p.getUsername() != null ? p.getUsername() : p.getNickname())
                    : null;
            items.add(new LeaderboardEntryResponse(
                    rank++,
                    s.getPlayerId(),
                    username,
                    s.getWins(),
                    s.getLosses(),
                    s.getWinRate().doubleValue()));
        }
        return new PageData<>(items, total);
    }
}
