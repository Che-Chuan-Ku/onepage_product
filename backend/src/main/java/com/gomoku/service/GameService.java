package com.gomoku.service;

import com.gomoku.domain.entity.Game;
import com.gomoku.domain.entity.Move;
import com.gomoku.domain.entity.OpeningStone;
import com.gomoku.domain.entity.PlayerStats;
import com.gomoku.domain.enums.CoinResult;
import com.gomoku.domain.enums.GameMode;
import com.gomoku.domain.enums.GameResult;
import com.gomoku.domain.enums.GameStatus;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.domain.enums.Swap2Choice;
import com.gomoku.dto.request.LocalGameCreateRequest;
import com.gomoku.dto.request.MoveCreateRequest;
import com.gomoku.dto.request.OpeningStoneCreateRequest;
import com.gomoku.dto.request.Swap2ChoiceRequest;
import com.gomoku.dto.response.CoinTossResponse;
import com.gomoku.dto.response.GameDetailResponse;
import com.gomoku.dto.response.GameReplayResponse;
import com.gomoku.dto.response.GameStateResponse;
import com.gomoku.exception.BusinessException;
import com.gomoku.exception.ErrorCode;
import com.gomoku.game.GomokuRules;
import com.gomoku.game.Swap2Phase;
import com.gomoku.repository.GameRepository;
import com.gomoku.repository.MoveRepository;
import com.gomoku.repository.OpeningStoneRepository;
import com.gomoku.repository.PlayerStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Server-authoritative game service.
 *
 * Covers:
 *  - Local game creation (startLocalGame)
 *  - Coin toss (tossCoin): standard black/white assignment OR Swap2 tentative-first
 *  - placeMove: turn/bounds/duplicate validation, 5-in-a-row win, full-board draw
 *  - Swap2 opening: placeOpeningStone, undoLastOpeningStone, makeSwap2Choice
 *  - rematchGame: creates a new game from the same room/config
 *  - getGameReplay: full move history for replay
 */
@Service
public class GameService {

    private final SecureRandom random = new SecureRandom();

    private final GameRepository gameRepository;
    private final MoveRepository moveRepository;
    private final OpeningStoneRepository openingStoneRepository;
    private final PlayerStatsRepository playerStatsRepository;
    private final GameBroadcaster broadcaster;

    public GameService(GameRepository gameRepository,
                       MoveRepository moveRepository,
                       OpeningStoneRepository openingStoneRepository,
                       PlayerStatsRepository playerStatsRepository,
                       GameBroadcaster broadcaster) {
        this.gameRepository = gameRepository;
        this.moveRepository = moveRepository;
        this.openingStoneRepository = openingStoneRepository;
        this.playerStatsRepository = playerStatsRepository;
        this.broadcaster = broadcaster;
    }

    // ────────────────────────── startLocalGame ───────────────────────────────

    /**
     * Create a LOCAL game (single-device, no online auth required).
     * If useSwap2, status=OPENING; otherwise status=PLAYING with BLACK to move first.
     */
    @Transactional
    public GameDetailResponse startLocalGame(LocalGameCreateRequest req) {
        Game game = new Game();
        game.setGameMode(GameMode.LOCAL);
        game.setUseSwap2(Boolean.TRUE.equals(req.useSwap2()));

        if (Boolean.TRUE.equals(req.useSwap2())) {
            game.setStatus(GameStatus.OPENING);
        } else {
            game.setStatus(GameStatus.PLAYING);
            game.setCurrentTurn(StoneColor.BLACK);
        }
        game = gameRepository.save(game);
        return toDetail(game);
    }

    // ────────────────────────── tossCoin ─────────────────────────────────────

    /**
     * Coin toss: random HEADS/TAILS.
     *  - Swap2 mode: assigns tentative-first player; status remains OPENING.
     *  - Standard: assigns black/white; starts normal play (PLAYING, BLACK to move).
     *
     * In LOCAL mode player IDs may be null; the coin result still determines first-mover.
     */
    @Transactional
    public CoinTossResponse tossCoin(String gameId, String requestingPlayerId) {
        Game game = requireGame(gameId);
        if (game.getStatus() == GameStatus.FINISHED) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "遊戲已結束");
        }
        if (game.getCoinResult() != null) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "硬幣已投過");
        }

        CoinResult coin = random.nextBoolean() ? CoinResult.HEADS : CoinResult.TAILS;
        game.setCoinResult(coin);

        String firstPlayerId = requestingPlayerId;  // heads = requester goes first
        boolean requesterFirst = (coin == CoinResult.HEADS);

        if (game.isUseSwap2()) {
            // Swap2: coin decides tentative-first; actual colors decided after opening
            if (requesterFirst) {
                game.setTentativeFirstPlayerId(requestingPlayerId);
            }
            // tentative-second stays null; handled when choice is made
        } else {
            // Standard: heads = requester is BLACK
            if (requesterFirst) {
                game.setBlackPlayerId(requestingPlayerId);
                // white: other player in an ONLINE game (not resolved here for LOCAL)
            } else {
                game.setWhitePlayerId(requestingPlayerId);
                // black: other player
            }
            game.setStatus(GameStatus.PLAYING);
            game.setCurrentTurn(StoneColor.BLACK);
        }

        gameRepository.save(game);

        broadcaster.broadcastGameState(gameId, toCoinTossResponse(game, coin));
        return toCoinTossResponse(game, coin);
    }

    // ────────────────────────── placeMove ────────────────────────────────────

    /**
     * Server-authoritative move placement.
     * Validates: game status, turn, bounds, occupied cell.
     * Evaluates: win (5+ in a row, long-line counts, no forbidden), draw (full board).
     */
    @Transactional
    public GameStateResponse placeMove(String gameId, String playerId, MoveCreateRequest req) {
        Game game = requireGame(gameId);

        if (game.getStatus() != GameStatus.PLAYING) {
            throw new BusinessException(ErrorCode.INVALID_MOVE,
                    game.getStatus() == GameStatus.OPENING ? "開局尚未完成" : "遊戲已結束");
        }
        if (!GomokuRules.inBounds(req.row(), req.col())) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "座標超出棋盤範圍");
        }

        StoneColor movingColor = game.getCurrentTurn();
        if (movingColor == null) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "輪次未設定");
        }

        // In ONLINE mode: verify it's this player's turn by player-id
        if (game.getGameMode() == GameMode.ONLINE) {
            String expectedPlayerId = (movingColor == StoneColor.BLACK)
                    ? game.getBlackPlayerId() : game.getWhitePlayerId();
            if (expectedPlayerId != null && !expectedPlayerId.equals(playerId)) {
                throw new BusinessException(ErrorCode.NOT_YOUR_TURN, "非您的回合");
            }
        }

        // Duplicate check: scan opening stones + moves
        if (openingStoneRepository.existsByGameIdAndRowAndCol(gameId, req.row(), req.col())) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "該位置已有開局子");
        }
        if (moveRepository.existsByGameIdAndRowAndCol(gameId, req.row(), req.col())) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "該位置已有棋子");
        }

        // Persist move
        Move move = new Move();
        move.setGameId(gameId);
        move.setMoveNumber(game.getMoveCount() + 1);
        move.setColor(movingColor);
        move.setRow(req.row());
        move.setCol(req.col());
        moveRepository.save(move);

        game.setMoveCount(game.getMoveCount() + 1);

        // Build board for win detection
        StoneColor[][] board = buildBoard(gameId);
        board[req.row()][req.col()] = movingColor;

        List<int[]> winLine = GomokuRules.findWinningLine(board, req.row(), req.col(), movingColor);
        GameStateResponse response;

        if (!winLine.isEmpty()) {
            // Win
            GameResult result = (movingColor == StoneColor.BLACK) ? GameResult.BLACK_WIN : GameResult.WHITE_WIN;
            game.setStatus(GameStatus.FINISHED);
            game.setResult(result);
            game.setCurrentTurn(null);
            game.setEndedAt(Instant.now());
            String winnerPlayerId = (movingColor == StoneColor.BLACK)
                    ? game.getBlackPlayerId() : game.getWhitePlayerId();
            game.setWinnerPlayerId(winnerPlayerId);
            gameRepository.save(game);

            updateStats(game, result);

            List<GameStateResponse.Cell> winCells = new ArrayList<>();
            for (int[] cell : winLine) {
                winCells.add(new GameStateResponse.Cell(cell[0], cell[1]));
            }
            response = new GameStateResponse(
                    gameId, game.getStatus().name(), null,
                    game.getMoveCount(),
                    new GameStateResponse.LastMove(movingColor.name(), req.row(), req.col()),
                    result.name(), winCells);
        } else if (GomokuRules.isBoardFull(board)) {
            // Draw
            game.setStatus(GameStatus.FINISHED);
            game.setResult(GameResult.DRAW);
            game.setCurrentTurn(null);
            game.setEndedAt(Instant.now());
            gameRepository.save(game);

            updateStats(game, GameResult.DRAW);

            response = new GameStateResponse(
                    gameId, game.getStatus().name(), null,
                    game.getMoveCount(),
                    new GameStateResponse.LastMove(movingColor.name(), req.row(), req.col()),
                    GameResult.DRAW.name(), null);
        } else {
            // Next turn
            StoneColor next = (movingColor == StoneColor.BLACK) ? StoneColor.WHITE : StoneColor.BLACK;
            game.setCurrentTurn(next);
            gameRepository.save(game);

            response = new GameStateResponse(
                    gameId, game.getStatus().name(), next.name(),
                    game.getMoveCount(),
                    new GameStateResponse.LastMove(movingColor.name(), req.row(), req.col()),
                    null, null);
        }

        broadcaster.broadcastGameState(gameId, response);
        return response;
    }

    // ────────────────────────── Swap2 opening ────────────────────────────────

    /**
     * Place one Swap2 opening stone. Only the tentative-first player may place.
     * Stones follow the strict sequence: B, W, B (first three), W, B (if PLACE_TWO_MORE chosen).
     */
    @Transactional
    public GameStateResponse placeOpeningStone(String gameId, String playerId,
                                               OpeningStoneCreateRequest req) {
        Game game = requireGame(gameId);

        if (!game.isUseSwap2()) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "非 Swap2 模式");
        }
        if (game.getStatus() != GameStatus.OPENING) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "非開局階段");
        }

        long placed = openingStoneRepository.countByGameId(gameId);
        Swap2Phase phase = Swap2Phase.fromState((int) placed, game.isSwap2TwoMoreChosen(), false);

        // Phase permission checks
        if (phase == Swap2Phase.PLACING_FIRST_THREE || phase == Swap2Phase.PLACING_SECOND_TWO) {
            // Only tentative-first can place in PLACING_FIRST_THREE
            // In PLACING_SECOND_TWO: tentative-second places (not tracked separately here;
            // we trust the caller since color sequence enforces ordering)
            if (phase == Swap2Phase.PLACING_FIRST_THREE) {
                requireTentativeFirst(game, playerId);
            }
        } else {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "當前開局階段不可放置");
        }

        // Validate color matches expected sequence
        StoneColor expected = Swap2Phase.expectedColor((int) placed);
        if (req.color() != expected) {
            throw new BusinessException(ErrorCode.INVALID_MOVE,
                    "開局子顏色應為 " + expected.name());
        }
        if (!GomokuRules.inBounds(req.row(), req.col())) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "座標超出棋盤範圍");
        }
        if (openingStoneRepository.existsByGameIdAndRowAndCol(gameId, req.row(), req.col())) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "該位置已有開局子");
        }

        OpeningStone stone = new OpeningStone();
        stone.setGameId(gameId);
        stone.setSequence((int) placed + 1);
        stone.setColor(req.color());
        stone.setRow(req.row());
        stone.setCol(req.col());
        stone.setPlacedByPlayerId(playerId);
        openingStoneRepository.save(stone);

        long newPlaced = placed + 1;
        Swap2Phase newPhase = Swap2Phase.fromState((int) newPlaced, game.isSwap2TwoMoreChosen(), false);

        GameStateResponse response = buildOpeningState(game, newPhase);
        broadcaster.broadcastOpening(gameId, response);
        return response;
    }

    /**
     * Undo the last placed opening stone (req #31). Only tentative-first may undo;
     * only during PLACING_FIRST_THREE or PLACING_SECOND_TWO.
     */
    @Transactional
    public GameStateResponse undoLastOpeningStone(String gameId, String playerId) {
        Game game = requireGame(gameId);

        if (!game.isUseSwap2()) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "非 Swap2 模式");
        }
        if (game.getStatus() != GameStatus.OPENING) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "非開局階段");
        }

        long placed = openingStoneRepository.countByGameId(gameId);
        if (placed == 0) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "沒有可悔的開局子");
        }

        Swap2Phase phase = Swap2Phase.fromState((int) placed, game.isSwap2TwoMoreChosen(), false);
        if (phase == Swap2Phase.AWAIT_SECOND_CHOICE || phase == Swap2Phase.AWAIT_FIRST_COLOR) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "選擇階段不可悔子");
        }

        requireTentativeFirst(game, playerId);

        OpeningStone last = openingStoneRepository.findFirstByGameIdOrderBySequenceDesc(gameId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "找不到開局子"));
        openingStoneRepository.delete(last);

        long newPlaced = placed - 1;
        Swap2Phase newPhase = Swap2Phase.fromState((int) newPlaced, game.isSwap2TwoMoreChosen(), false);

        GameStateResponse response = buildOpeningState(game, newPhase);
        broadcaster.broadcastOpening(gameId, response);
        return response;
    }

    /**
     * Tentative-second (or tentative-first after PLACE_TWO_MORE) makes the Swap2 choice.
     * TAKE_BLACK / TAKE_WHITE → colors finalized → status=PLAYING.
     * PLACE_TWO_MORE → phase transitions to PLACING_SECOND_TWO.
     */
    @Transactional
    public GameStateResponse makeSwap2Choice(String gameId, String playerId,
                                             Swap2ChoiceRequest req) {
        Game game = requireGame(gameId);

        if (!game.isUseSwap2()) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "非 Swap2 模式");
        }
        if (game.getStatus() != GameStatus.OPENING) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "非開局階段");
        }

        long placed = openingStoneRepository.countByGameId(gameId);
        Swap2Phase phase = Swap2Phase.fromState((int) placed, game.isSwap2TwoMoreChosen(), false);

        GameStateResponse response;

        if (phase == Swap2Phase.AWAIT_SECOND_CHOICE) {
            // Only tentative-second can choose here (not tentative-first)
            requireTentativeSecond(game, playerId);

            if (req.choice() == Swap2Choice.PLACE_TWO_MORE) {
                // Persist the choice — the phase derivation at 3 stones depends
                // on it (the choice adds no stone, count alone can't tell).
                game.setSwap2TwoMoreChosen(true);
                gameRepository.save(game);
                response = buildOpeningState(game, Swap2Phase.PLACING_SECOND_TWO);
                broadcaster.broadcastOpening(gameId, response);
                return response;
            } else {
                // TAKE_BLACK or TAKE_WHITE
                finalizeColors(game, playerId, req.choice(), true);
            }

        } else if (phase == Swap2Phase.AWAIT_FIRST_COLOR) {
            // Only PLACE_TWO_MORE was chosen previously → tentative-first picks color
            requireTentativeFirst(game, playerId);
            if (req.choice() == Swap2Choice.PLACE_TWO_MORE) {
                throw new BusinessException(ErrorCode.UNPROCESSABLE, "此階段不可選 PLACE_TWO_MORE");
            }
            finalizeColors(game, playerId, req.choice(), false);

        } else {
            throw new BusinessException(ErrorCode.UNPROCESSABLE,
                    "當前開局階段不可做選擇 (phase=" + phase + ")");
        }

        gameRepository.save(game);
        response = new GameStateResponse(
                gameId, game.getStatus().name(),
                game.getCurrentTurn() == null ? null : game.getCurrentTurn().name(),
                game.getMoveCount(), null, null, null);
        broadcaster.broadcastOpening(gameId, response);
        broadcaster.broadcastGameState(gameId, response);
        return response;
    }

    // ────────────────────────── rematch ──────────────────────────────────────

    /**
     * Create a new game from the same room / config (req #12 #14).
     * Previous game must be FINISHED (or be a LOCAL game in any terminal state).
     */
    @Transactional
    public GameDetailResponse rematchGame(String gameId) {
        Game old = requireGame(gameId);
        if (old.getStatus() != GameStatus.FINISHED) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "對局尚未結束，無法再戰");
        }

        Game newGame = new Game();
        newGame.setGameMode(old.getGameMode());
        newGame.setRoomId(old.getRoomId());
        newGame.setUseSwap2(old.isUseSwap2());

        if (old.isUseSwap2()) {
            newGame.setStatus(GameStatus.OPENING);
        } else {
            newGame.setStatus(GameStatus.PLAYING);
            newGame.setCurrentTurn(StoneColor.BLACK);
        }
        // Swap player colors for rematch fairness
        newGame.setBlackPlayerId(old.getWhitePlayerId());
        newGame.setWhitePlayerId(old.getBlackPlayerId());

        newGame = gameRepository.save(newGame);
        return toDetail(newGame);
    }

    // ────────────────────────── replay ───────────────────────────────────────

    @Transactional(readOnly = true)
    public GameReplayResponse getGameReplay(String gameId) {
        Game game = requireGame(gameId);

        List<OpeningStone> opening = openingStoneRepository.findByGameIdOrderBySequenceAsc(gameId);
        List<Move> moves = moveRepository.findByGameIdOrderByMoveNumberAsc(gameId);

        List<GameReplayResponse.OpeningStoneItem> openingItems = new ArrayList<>();
        for (OpeningStone s : opening) {
            openingItems.add(new GameReplayResponse.OpeningStoneItem(
                    s.getSequence(), s.getColor().name(), s.getRow(), s.getCol()));
        }

        List<GameReplayResponse.MoveItem> moveItems = new ArrayList<>();
        for (Move m : moves) {
            moveItems.add(new GameReplayResponse.MoveItem(
                    m.getMoveNumber(), m.getColor().name(), m.getRow(), m.getCol()));
        }

        return new GameReplayResponse(
                gameId,
                game.getResult() == null ? null : game.getResult().name(),
                game.getWinnerPlayerId(),
                game.getMoveCount(),
                game.isUseSwap2(),
                openingItems,
                moveItems);
    }

    // ────────────────────────── helpers ──────────────────────────────────────

    private Game requireGame(String gameId) {
        return gameRepository.findByIdAndDeletedFalse(gameId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "遊戲不存在"));
    }

    private void requireTentativeFirst(Game game, String playerId) {
        if (game.getGameMode() == GameMode.ONLINE) {
            if (playerId == null || !playerId.equals(game.getTentativeFirstPlayerId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "僅假先方可操作");
            }
        }
    }

    private void requireTentativeSecond(Game game, String playerId) {
        if (game.getGameMode() == GameMode.ONLINE) {
            String first = game.getTentativeFirstPlayerId();
            if (playerId == null || playerId.equals(first)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "僅假後方可做選擇");
            }
        }
    }

    /**
     * Finalize black/white from a Swap2 choice.
     *
     * @param chooserIsSecond true  = tentative-second is making the choice (after first 3 stones);
     *                        false = tentative-first is making the color pick (after PLACE_TWO_MORE).
     *
     * Color assignment:
     *   chooserIsSecond=true,  TAKE_BLACK → chooser=BLACK, firstId=WHITE
     *   chooserIsSecond=true,  TAKE_WHITE → chooser=WHITE, firstId=BLACK
     *   chooserIsSecond=false, TAKE_BLACK → chooser (firstId)=BLACK, opponent (unknown)=WHITE
     *   chooserIsSecond=false, TAKE_WHITE → chooser (firstId)=WHITE, opponent (unknown)=BLACK
     */
    private void finalizeColors(Game game, String chooserId, Swap2Choice choice,
                                 boolean chooserIsSecond) {
        String firstId = game.getTentativeFirstPlayerId();

        if (chooserIsSecond) {
            // chooser is tentative-second; firstId is tentative-first
            if (choice == Swap2Choice.TAKE_BLACK) {
                game.setBlackPlayerId(chooserId);
                game.setWhitePlayerId(firstId);
            } else { // TAKE_WHITE
                game.setWhitePlayerId(chooserId);
                game.setBlackPlayerId(firstId);
            }
        } else {
            // chooser is tentative-first (picking color after PLACE_TWO_MORE)
            if (choice == Swap2Choice.TAKE_BLACK) {
                game.setBlackPlayerId(chooserId); // firstId takes black
                // white = tentative-second; not resolved here (room-based ONLINE will know)
            } else { // TAKE_WHITE
                game.setWhitePlayerId(chooserId); // firstId takes white
                // black = tentative-second
            }
        }

        game.setStatus(GameStatus.PLAYING);
        // 需求 #30 / OpeningCompleted: play resumes following the opening-stone
        // alternation (B,W,B[,W,B]) — after 3 or 5 opening stones the next move
        // is always WHITE, not BLACK.
        long placed = openingStoneRepository.countByGameId(game.getId());
        game.setCurrentTurn(placed % 2 == 1 ? StoneColor.WHITE : StoneColor.BLACK);
    }

    /** Build a 15×15 board from persisted moves + opening stones for a game. */
    private StoneColor[][] buildBoard(String gameId) {
        StoneColor[][] board = new StoneColor[GomokuRules.SIZE][GomokuRules.SIZE];

        List<OpeningStone> opening = openingStoneRepository.findByGameIdOrderBySequenceAsc(gameId);
        for (OpeningStone s : opening) {
            board[s.getRow()][s.getCol()] = s.getColor();
        }
        List<Move> moves = moveRepository.findByGameIdOrderByMoveNumberAsc(gameId);
        for (Move m : moves) {
            board[m.getRow()][m.getCol()] = m.getColor();
        }
        return board;
    }

    private GameStateResponse buildOpeningState(Game game, Swap2Phase phase) {
        return new GameStateResponse(
                game.getId(),
                game.getStatus().name(),
                null,
                game.getMoveCount(),
                null,
                null,
                null);
    }

    private GameDetailResponse toDetail(Game game) {
        return new GameDetailResponse(
                game.getId(),
                game.getGameMode().name(),
                game.isUseSwap2(),
                game.getStatus().name(),
                game.getCurrentTurn() == null ? null : game.getCurrentTurn().name());
    }

    private CoinTossResponse toCoinTossResponse(Game game, CoinResult coin) {
        return new CoinTossResponse(
                game.getId(),
                coin.name(),
                game.getTentativeFirstPlayerId(),
                game.getBlackPlayerId(),
                game.getWhitePlayerId());
    }

    /** Update PlayerStats after a finished game. Only for ONLINE games with assigned players. */
    private void updateStats(Game game, GameResult result) {
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
                if (blackStats != null) { blackStats.setWins(blackStats.getWins() + 1); blackStats.recomputeWinRate(); playerStatsRepository.save(blackStats); }
                if (whiteStats != null) { whiteStats.setLosses(whiteStats.getLosses() + 1); whiteStats.recomputeWinRate(); playerStatsRepository.save(whiteStats); }
            }
            case WHITE_WIN -> {
                if (whiteStats != null) { whiteStats.setWins(whiteStats.getWins() + 1); whiteStats.recomputeWinRate(); playerStatsRepository.save(whiteStats); }
                if (blackStats != null) { blackStats.setLosses(blackStats.getLosses() + 1); blackStats.recomputeWinRate(); playerStatsRepository.save(blackStats); }
            }
            case DRAW -> {
                if (blackStats != null) { blackStats.setDraws(blackStats.getDraws() + 1); playerStatsRepository.save(blackStats); }
                if (whiteStats != null) { whiteStats.setDraws(whiteStats.getDraws() + 1); playerStatsRepository.save(whiteStats); }
            }
        }
    }
}
