package com.gomoku.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.domain.entity.FieldCell;
import com.gomoku.domain.entity.FieldEvent;
import com.gomoku.domain.entity.FieldState;
import com.gomoku.domain.entity.Game;
import com.gomoku.domain.entity.Move;
import com.gomoku.domain.entity.SkillUsage;
import com.gomoku.domain.enums.ClassType;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.FieldEventType;
import com.gomoku.domain.enums.FieldType;
import com.gomoku.domain.enums.GameMode;
import com.gomoku.domain.enums.GameResult;
import com.gomoku.domain.enums.GameStatus;
import com.gomoku.domain.enums.SkillDirection;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.dto.request.MoveCreateRequest;
import com.gomoku.dto.request.SkillActionRequest;
import com.gomoku.dto.response.GameStateResponse;
import com.gomoku.exception.BusinessException;
import com.gomoku.exception.ErrorCode;
import com.gomoku.game.BoardReplayer;
import com.gomoku.game.FieldEventDetail;
import com.gomoku.game.FieldGenerator;
import com.gomoku.game.FieldGeometry;
import com.gomoku.game.GomokuRules;
import com.gomoku.game.PushResolver;
import com.gomoku.game.SeriousBoard;
import com.gomoku.repository.FieldCellRepository;
import com.gomoku.repository.FieldEventRepository;
import com.gomoku.repository.FieldStateRepository;
import com.gomoku.repository.MoveRepository;
import com.gomoku.repository.SkillUsageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Serious Duel (真劍勝負) settlement engine — req #35–#47.
 *
 * Turn action economy (Q1): one main action per turn — a plain placement, a
 * placement with an attached normal skill, or an ultimate cast that replaces
 * the placement.
 *
 * Settlement order (Q2): placement → skill effects → field effects → one and
 * only one win check. Simultaneous five-in-a-row for both sides → the acting
 * player wins.
 */
@Service
public class SeriousDuelService {

    private static final int WAVE_HANDS = 10; // 5 rounds x 2 hands (Q7)

    private final MoveRepository moveRepository;
    private final SkillUsageRepository skillUsageRepository;
    private final FieldCellRepository fieldCellRepository;
    private final FieldStateRepository fieldStateRepository;
    private final FieldEventRepository fieldEventRepository;
    private final StatsService statsService;
    private final GameBroadcaster broadcaster;
    private final ObjectMapper objectMapper;
    private final FieldGenerator fieldGenerator = new FieldGenerator();

    public SeriousDuelService(MoveRepository moveRepository,
                              SkillUsageRepository skillUsageRepository,
                              FieldCellRepository fieldCellRepository,
                              FieldStateRepository fieldStateRepository,
                              FieldEventRepository fieldEventRepository,
                              StatsService statsService,
                              GameBroadcaster broadcaster,
                              ObjectMapper objectMapper) {
        this.moveRepository = moveRepository;
        this.skillUsageRepository = skillUsageRepository;
        this.fieldCellRepository = fieldCellRepository;
        this.fieldStateRepository = fieldStateRepository;
        this.fieldEventRepository = fieldEventRepository;
        this.statsService = statsService;
        this.broadcaster = broadcaster;
        this.objectMapper = objectMapper;
    }

    // ────────────────────────── field generation ─────────────────────────────

    /**
     * Generate the field at game creation (req #39 #40): field_cells +
     * field_states + a FIELD_GENERATED event (move_number null). Hidden cell
     * positions stay server-side only (req #44).
     */
    @Transactional
    public void initializeField(Game game) {
        FieldType fieldType = game.getFieldType();
        FieldGenerator.GeneratedField generated = fieldGenerator.generate(fieldType);

        for (FieldGenerator.GeneratedCell cell : generated.cells()) {
            FieldCell entity = new FieldCell();
            entity.setGameId(game.getId());
            entity.setCellKind(cell.kind());
            entity.setRow(cell.row());
            entity.setCol(cell.col());
            entity.setVisibleToPlayers(cell.visible());
            fieldCellRepository.save(entity);
        }

        FieldState state = new FieldState();
        state.setGameId(game.getId());
        state.setFieldType(fieldType);
        state.setSeaSide(generated.seaSide());
        fieldStateRepository.save(state);

        FieldEvent event = new FieldEvent();
        event.setGameId(game.getId());
        event.setMoveNumber(null);
        event.setEventType(FieldEventType.FIELD_GENERATED);
        fieldEventRepository.save(event);
    }

    // ────────────────────────── hand settlement ──────────────────────────────

    @Transactional
    public GameStateResponse resolveHand(Game game, String playerId, MoveCreateRequest req) {
        if (game.getStatus() != GameStatus.PLAYING) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "遊戲已結束");
        }
        StoneColor actor = game.getCurrentTurn();
        if (actor == null) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "輪次未設定");
        }
        String actorPlayerId = (actor == StoneColor.BLACK)
                ? game.getBlackPlayerId() : game.getWhitePlayerId();
        if (game.getGameMode() == GameMode.ONLINE
                && actorPlayerId != null && !actorPlayerId.equals(playerId)) {
            throw new BusinessException(ErrorCode.NOT_YOUR_TURN, "非您的回合");
        }
        if (actorPlayerId == null) {
            actorPlayerId = playerId;
        }

        SkillActionRequest skill = req.skill();
        validateActionShape(req, skill);
        if (skill != null) {
            validateSkillUsable(game, actor, actorPlayerId, skill.skillType());
        }

        int size = FieldGeometry.boardSize(game.getFieldType());
        List<FieldCell> fieldCells = fieldCellRepository.findByGameIdAndDeletedFalse(game.getId());
        FieldState fieldState = requireFieldState(game.getId());
        SeriousBoard board = rebuildBoard(game, size, fieldCells);

        Settlement settlement = new Settlement(game, board, fieldCells, fieldState, actor);

        // 1) Placement (+ attached normal skill) or ultimate cast.
        if (skill == null) {
            placePlain(settlement, req.row(), req.col());
        } else {
            executeSkill(settlement, req, skill);
        }

        // Persist move rows + skill usage before field effects reference numbers.
        int nextNumber = game.getMoveCount();
        for (int[] pos : settlement.placements) {
            nextNumber++;
            Move move = new Move();
            move.setGameId(game.getId());
            move.setMoveNumber(nextNumber);
            move.setColor(actor);
            move.setRow(pos[0]);
            move.setCol(pos[1]);
            moveRepository.save(move);
        }
        game.setMoveCount(nextNumber);
        settlement.settleMoveNumber = nextNumber;

        if (skill != null) {
            SkillUsage usage = new SkillUsage();
            usage.setGameId(game.getId());
            usage.setPlayerId(actorPlayerId);
            usage.setSkillType(skill.skillType());
            usage.setMoveNumber(nextNumber);
            skillUsageRepository.save(usage);
        }

        // 2) Field effects: hidden-cell triggers on this hand's placements, then wave.
        resolveHiddenCellTriggers(settlement);
        resolveWave(settlement);
        fieldStateRepository.save(fieldState);

        persistEvents(settlement);

        // 3) The one and only win check (Q2).
        GameStateResponse response = judgeAndBuildResponse(settlement, playerId);
        broadcaster.broadcastGameState(game.getId(), response);
        return response;
    }

    // ────────────────────────── action validation ────────────────────────────

    private void validateActionShape(MoveCreateRequest req, SkillActionRequest skill) {
        boolean hasCoords = req.row() != null || req.col() != null;
        if (skill == null) {
            if (req.row() == null || req.col() == null) {
                throw new BusinessException(ErrorCode.INVALID_MOVE, "落子座標必填");
            }
            return;
        }
        SkillType type = skill.skillType();
        if (type == null) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "技能型別必填");
        }
        if (type.isUltimate()) {
            // api.yml oneOf: ultimate branch forbids row/col. A request carrying both a
            // placement and an ultimate (schema-gap noted in api.yml) is rejected here.
            if (hasCoords) {
                throw new BusinessException(ErrorCode.INVALID_MOVE, "每回合僅能選擇一個主要動作");
            }
            if (skill.anchor() == null || skill.anchor().row() == null || skill.anchor().col() == null) {
                throw new BusinessException(ErrorCode.INVALID_MOVE, "大絕錨點必填");
            }
            // direction is validated in executeUltimate AFTER the anchor-empty
            // check — an occupied anchor must fail with the anchor message even
            // when the direction is also missing (feature: 錨點非空格 examples).
        } else {
            if (req.row() == null || req.col() == null) {
                throw new BusinessException(ErrorCode.INVALID_MOVE, "一般技能必須附掛於本手落子");
            }
        }
    }

    private void validateSkillUsable(Game game, StoneColor actor, String actorPlayerId, SkillType type) {
        ClassType actorClass = (actor == StoneColor.BLACK) ? game.getBlackClass() : game.getWhiteClass();
        if (actorClass == null || type.getClassType() != actorClass) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "職業不符，無法使用該技能");
        }
        if (skillUsageRepository.existsByGameIdAndPlayerIdAndSkillType(game.getId(), actorPlayerId, type)) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "該技能本場已使用過");
        }
    }

    // ────────────────────────── action execution ─────────────────────────────

    private void placePlain(Settlement s, int row, int col) {
        validatePlaceable(s.board, row, col);
        s.board.setStone(row, col, s.actor);
        s.placements.add(new int[]{row, col});
    }

    private void executeSkill(Settlement s, MoveCreateRequest req, SkillActionRequest skill) {
        switch (skill.skillType()) {
            case HORIZONTAL_SLASH -> {
                if (skill.direction() != SkillDirection.UP && skill.direction() != SkillDirection.DOWN) {
                    throw new BusinessException(ErrorCode.INVALID_MOVE, "橫劈方向必須為上或下");
                }
                placePlain(s, req.row(), req.col());
                slashPush(s, req.row(), req.col(), skill.direction(), true);
            }
            case VERTICAL_SLASH -> {
                if (skill.direction() != SkillDirection.LEFT && skill.direction() != SkillDirection.RIGHT) {
                    throw new BusinessException(ErrorCode.INVALID_MOVE, "縱劈方向必須為左或右");
                }
                placePlain(s, req.row(), req.col());
                slashPush(s, req.row(), req.col(), skill.direction(), false);
            }
            case PRECISION_SNIPE -> executeSnipe(s, req, skill);
            case SCATTER_SHOT -> executeScatter(s, req, skill);
            case HEAVEN_EARTH_REVERSAL, PIONEER_STAR -> executeUltimate(s, skill);
        }
    }

    /**
     * Slash push (Q10): the 3 cells adjacent to the placed stone in the chosen
     * direction (front + both diagonals) are pushed 1 cell that way, using the
     * shared chain resolver (req #38).
     */
    private void slashPush(Settlement s, int row, int col, SkillDirection dir, boolean horizontal) {
        int dr = dir.dRow();
        int dc = dir.dCol();
        List<int[]> sources = new ArrayList<>(3);
        for (int side = -1; side <= 1; side++) {
            int r = horizontal ? row + dr : row + side;
            int c = horizontal ? col + side : col + dc;
            if (s.board.inBounds(r, c)) {
                sources.add(new int[]{r, c});
            }
        }
        PushResolver.Outcome outcome = PushResolver.push(s.board, sources, dir);
        recordPushOutcome(s, outcome);
    }

    /** Precision snipe (Q10): replace one existing enemy stone; that IS this hand's move. */
    private void executeSnipe(Settlement s, MoveCreateRequest req, SkillActionRequest skill) {
        int row = req.row();
        int col = req.col();
        if (skill.target() != null && skill.target().row() != null
                && (skill.target().row() != row || skill.target().col() != col)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "精準狙擊 target 與落子座標不一致");
        }
        if (!s.board.inBounds(row, col)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "座標超出棋盤範圍");
        }
        StoneColor existing = s.board.stoneAt(row, col);
        StoneColor enemy = (s.actor == StoneColor.BLACK) ? StoneColor.WHITE : StoneColor.BLACK;
        if (existing != enemy) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "該位置無現存敵方棋子");
        }
        s.board.setStone(row, col, s.actor);
        s.placements.add(new int[]{row, col});
        s.addEvent(FieldEventType.STONE_REPLACED, row, col,
                FieldEventDetail.replaced(row, col, enemy.name(), s.actor.name()));
    }

    /** Scatter shot (Q10): two stones in one hand, Chebyshev distance >= 2. */
    private void executeScatter(Settlement s, MoveCreateRequest req, SkillActionRequest skill) {
        if (skill.secondStone() == null || skill.secondStone().row() == null
                || skill.secondStone().col() == null) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "散射必須指定第二顆棋子座標");
        }
        int r1 = req.row();
        int c1 = req.col();
        int r2 = skill.secondStone().row();
        int c2 = skill.secondStone().col();
        int chebyshev = Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
        if (chebyshev < 2) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "散射兩子不得在彼此九宮格內");
        }
        validatePlaceable(s.board, r1, c1);
        validatePlaceable(s.board, r2, c2);
        s.board.setStone(r1, c1, s.actor);
        s.placements.add(new int[]{r1, c1});
        s.board.setStone(r2, c2, s.actor);
        s.placements.add(new int[]{r2, c2});
    }

    /** Ultimates (Q4): 3-wide x 2-deep zone INCLUDING an EMPTY anchor cell. */
    private void executeUltimate(Settlement s, SkillActionRequest skill) {
        int anchorRow = skill.anchor().row();
        int anchorCol = skill.anchor().col();
        if (!s.board.inBounds(anchorRow, anchorCol)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "座標超出棋盤範圍");
        }
        if (!s.board.isEmptyPlayable(anchorRow, anchorCol)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "大絕錨點格必須為空格");
        }
        if (skill.direction() == null) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "必須指定施法方向");
        }
        List<int[]> zone = FieldGeometry.ultimateZone(anchorRow, anchorCol,
                skill.direction(), s.board.size());

        if (skill.skillType() == SkillType.HEAVEN_EARTH_REVERSAL) {
            List<FieldEventDetail> swapped = new ArrayList<>();
            for (int[] cell : zone) {
                StoneColor color = s.board.stoneAt(cell[0], cell[1]);
                if (color != null) {
                    StoneColor flipped = (color == StoneColor.BLACK) ? StoneColor.WHITE : StoneColor.BLACK;
                    s.board.setStone(cell[0], cell[1], flipped);
                    swapped.add(FieldEventDetail.swapped(cell[0], cell[1], color.name(), flipped.name()));
                }
            }
            s.addEvent(FieldEventType.COLORS_SWAPPED, anchorRow, anchorCol,
                    FieldEventDetail.cellList(swapped));
        } else { // PIONEER_STAR
            List<FieldEventDetail> cleared = new ArrayList<>();
            for (int[] cell : zone) {
                StoneColor color = s.board.stoneAt(cell[0], cell[1]);
                if (color != null) {
                    s.board.removeStone(cell[0], cell[1]);
                    cleared.add(FieldEventDetail.cell(cell[0], cell[1], color.name()));
                }
            }
            s.addEvent(FieldEventType.STONES_CLEARED, anchorRow, anchorCol,
                    FieldEventDetail.cellList(cleared));
        }
    }

    private void validatePlaceable(SeriousBoard board, int row, int col) {
        if (!board.inBounds(row, col)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "座標超出棋盤範圍");
        }
        if (board.isObstacle(row, col)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "該格為障礙物，禁止落子");
        }
        if (board.hasStone(row, col)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "該位置已有棋子");
        }
    }

    // ────────────────────────── field effects ────────────────────────────────

    /** Hidden ERUPTION/TIDE cells trigger when a stone is placed on them (req #39 #40). */
    private void resolveHiddenCellTriggers(Settlement s) {
        for (int[] pos : s.placements) {
            FieldCell hidden = findUntriggeredHidden(s.fieldCells, pos[0], pos[1]);
            if (hidden == null) {
                continue;
            }
            hidden.setTriggered(true);
            hidden.setVisibleToPlayers(true);
            hidden.setTriggeredAt(Instant.now());
            fieldCellRepository.save(hidden);

            if (hidden.getCellKind() == FieldCellKind.ERUPTION) {
                s.addEvent(FieldEventType.VOLCANO_ERUPTED, pos[0], pos[1], null);
                List<FieldEventDetail> burned = new ArrayList<>();
                for (int[] n : FieldGeometry.eightNeighbors(pos[0], pos[1], s.board.size())) {
                    StoneColor color = s.board.stoneAt(n[0], n[1]);
                    if (color != null) {
                        s.board.removeStone(n[0], n[1]);
                        burned.add(FieldEventDetail.cell(n[0], n[1], color.name()));
                    }
                }
                // The trigger stone itself is kept (Q5) — it is not in its own 8-neighborhood.
                s.addEvent(FieldEventType.STONES_BURNED, pos[0], pos[1],
                        FieldEventDetail.cellList(burned));
            } else if (hidden.getCellKind() == FieldCellKind.TIDE) {
                s.fieldState.setTideTriggered(true);
                s.addEvent(FieldEventType.TIDE_TRIGGERED, pos[0], pos[1], null);
            }
        }
    }

    /**
     * Wave settlement (req #41, Q7): every 10 hands the wave pushes all stones
     * on ocean cells 1 cell toward the sand (shared resolver); after the tide
     * has been triggered, each wave additionally erodes the sand line closest
     * to the sea. Stones on eroded cells stay and count as ocean stones later.
     */
    private void resolveWave(Settlement s) {
        s.fieldState.setRoundCounter(s.fieldState.getRoundCounter() + 1);
        if (s.fieldState.getFieldType() != FieldType.BEACH
                || s.fieldState.getRoundCounter() < WAVE_HANDS) {
            return;
        }
        s.fieldState.setRoundCounter(0);
        s.addEvent(FieldEventType.WAVE_SURGED, null, null, null);

        SkillDirection dir = FieldGeometry.wavePushDirection(s.fieldState.getSeaSide());
        List<int[]> sources = new ArrayList<>();
        for (int r = 0; r < s.board.size(); r++) {
            for (int c = 0; c < s.board.size(); c++) {
                if (s.board.hasStone(r, c) && FieldGeometry.isOcean(
                        r, c, s.fieldState.getSeaSide(), s.fieldState.getErodedRows())) {
                    sources.add(new int[]{r, c});
                }
            }
        }
        recordPushOutcome(s, PushResolver.push(s.board, sources, dir));

        if (s.fieldState.isTideTriggered()) {
            int line = FieldGeometry.nextErodedLine(
                    s.fieldState.getSeaSide(), s.fieldState.getErodedRows());
            if (line >= 0) {
                s.fieldState.setErodedRows(s.fieldState.getErodedRows() + 1);
                s.addEvent(FieldEventType.SAND_ERODED, null, null, FieldEventDetail.erodedLine(line));
                s.addEvent(FieldEventType.TIDE_RISEN, null, null, null);
            }
        }
    }

    private void recordPushOutcome(Settlement s, PushResolver.Outcome outcome) {
        for (PushResolver.Pushed p : outcome.pushed()) {
            s.addEvent(FieldEventType.STONE_PUSHED, p.toRow(), p.toCol(),
                    FieldEventDetail.pushed(p.fromRow(), p.fromCol(), p.toRow(), p.toCol(), p.color().name()));
        }
        for (PushResolver.Removed r : outcome.removed()) {
            s.addEvent(FieldEventType.STONE_REMOVED_OFF_BOARD, r.row(), r.col(),
                    FieldEventDetail.removed(r.row(), r.col(), r.color().name()));
        }
    }

    // ────────────────────────── win judgement + response ─────────────────────

    private GameStateResponse judgeAndBuildResponse(Settlement s, String requestPlayerId) {
        Game game = s.game;
        List<int[]> blackLine = GomokuRules.scanWinningLine(s.board.stones(), StoneColor.BLACK);
        List<int[]> whiteLine = GomokuRules.scanWinningLine(s.board.stones(), StoneColor.WHITE);

        GameResult result = null;
        List<int[]> winLine = null;
        if (!blackLine.isEmpty() && !whiteLine.isEmpty()) {
            // Simultaneous five-in-a-row: the acting player wins (Q2).
            result = (s.actor == StoneColor.BLACK) ? GameResult.BLACK_WIN : GameResult.WHITE_WIN;
            winLine = (s.actor == StoneColor.BLACK) ? blackLine : whiteLine;
        } else if (!blackLine.isEmpty()) {
            result = GameResult.BLACK_WIN;
            winLine = blackLine;
        } else if (!whiteLine.isEmpty()) {
            result = GameResult.WHITE_WIN;
            winLine = whiteLine;
        } else if (s.board.isFull()) {
            result = GameResult.DRAW;
        }

        String currentTurn;
        if (result != null) {
            game.setStatus(GameStatus.FINISHED);
            game.setResult(result);
            game.setCurrentTurn(null);
            game.setEndedAt(Instant.now());
            if (result != GameResult.DRAW) {
                StoneColor winner = (result == GameResult.BLACK_WIN) ? StoneColor.BLACK : StoneColor.WHITE;
                game.setWinnerPlayerId(winner == StoneColor.BLACK
                        ? game.getBlackPlayerId() : game.getWhitePlayerId());
            }
            statsService.updateStats(game, result);
            currentTurn = null;
        } else {
            StoneColor next = (s.actor == StoneColor.BLACK) ? StoneColor.WHITE : StoneColor.BLACK;
            game.setCurrentTurn(next);
            currentTurn = next.name();
        }

        List<GameStateResponse.Cell> winCells = null;
        if (winLine != null) {
            winCells = new ArrayList<>();
            for (int[] cell : winLine) {
                winCells.add(new GameStateResponse.Cell(cell[0], cell[1]));
            }
        }

        GameStateResponse.LastMove lastMove = null;
        if (!s.placements.isEmpty()) {
            int[] last = s.placements.get(s.placements.size() - 1);
            lastMove = new GameStateResponse.LastMove(s.actor.name(), last[0], last[1]);
        }

        List<GameStateResponse.SkillEventView> eventViews = new ArrayList<>();
        for (PendingEvent e : s.events) {
            eventViews.add(new GameStateResponse.SkillEventView(
                    e.type.name(), e.row, e.col, true));
        }

        return new GameStateResponse(
                game.getId(),
                game.getStatus().name(),
                currentTurn,
                game.getMoveCount(),
                lastMove,
                result == null ? null : result.name(),
                winCells,
                game.getBlackClass() == null ? null : game.getBlackClass().name(),
                game.getWhiteClass() == null ? null : game.getWhiteClass().name(),
                buildFieldStateView(s.fieldCells, s.fieldState),
                buildRevealedHiddenCells(s.fieldCells, result != null),
                eventViews,
                buildStoneSnapshot(s.board));
    }

    /** Authoritative occupied-cell snapshot (bug fix: see GameStateResponse.stones doc). */
    private List<GameStateResponse.StoneView> buildStoneSnapshot(SeriousBoard board) {
        List<GameStateResponse.StoneView> stones = new ArrayList<>();
        for (int r = 0; r < board.size(); r++) {
            for (int c = 0; c < board.size(); c++) {
                StoneColor color = board.stoneAt(r, c);
                if (color != null) {
                    stones.add(new GameStateResponse.StoneView(r, c, color.name()));
                }
            }
        }
        return stones;
    }

    // ────────────────────────── read-side views ───────────────────────────────

    /** Current serious-duel state for GET / reconnect (req #46); no per-hand events. */
    @Transactional(readOnly = true)
    public GameStateResponse buildState(Game game) {
        List<FieldCell> fieldCells = fieldCellRepository.findByGameIdAndDeletedFalse(game.getId());
        FieldState fieldState = requireFieldState(game.getId());
        List<Move> moves = moveRepository.findByGameIdOrderByMoveNumberAsc(game.getId());
        Move last = moves.isEmpty() ? null : moves.get(moves.size() - 1);
        int size = FieldGeometry.boardSize(game.getFieldType());
        SeriousBoard board = rebuildBoard(game, size, fieldCells);

        return new GameStateResponse(
                game.getId(),
                game.getStatus().name(),
                game.getCurrentTurn() == null ? null : game.getCurrentTurn().name(),
                game.getMoveCount(),
                last == null ? null
                        : new GameStateResponse.LastMove(last.getColor().name(), last.getRow(), last.getCol()),
                game.getResult() == null ? null : game.getResult().name(),
                null,
                revealClasses(game) && game.getBlackClass() != null ? game.getBlackClass().name() : null,
                revealClasses(game) && game.getWhiteClass() != null ? game.getWhiteClass().name() : null,
                buildFieldStateView(fieldCells, fieldState),
                buildRevealedHiddenCells(fieldCells, game.getStatus() == GameStatus.FINISHED),
                List.of(),
                buildStoneSnapshot(board));
    }

    /** Full skill-usage history for replay/reconnect (R2-3: restore used-skill state). */
    @Transactional(readOnly = true)
    public List<SkillUsage> listSkillUsages(String gameId) {
        return skillUsageRepository.findByGameIdOrderByUsedAtAsc(gameId);
    }

    /**
     * Bug fix: GameReplayResponse.fieldEvents' FIELD_GENERATED entries carry
     * row=null/col=null (it is a game-level event, not tied to one cell) — the
     * frontend cannot infer obstacle layout or beach ocean side from it, so the
     * replay/reconnect ("primary") path silently rendered wrong (BEACH always
     * defaulted to ocean-on-UP; VOLCANO obstacles never appeared). Expose the
     * same authoritative obstacle list + seaSide already used for live state
     * (buildFieldStateView) here too.
     */
    public record FieldSummary(List<FieldCell> obstacles, String seaSide) {
    }

    @Transactional(readOnly = true)
    public FieldSummary buildFieldSummary(String gameId) {
        List<FieldCell> obstacles = fieldCellRepository.findByGameIdAndDeletedFalse(gameId).stream()
                .filter(c -> c.getCellKind() == FieldCellKind.OBSTACLE)
                .toList();
        FieldState fieldState = requireFieldState(gameId);
        String seaSide = fieldState.getSeaSide() == null ? null : fieldState.getSeaSide().name();
        return new FieldSummary(obstacles, seaSide);
    }

    /** Classes are revealed once the game is PLAYING or later (req #35). */
    private boolean revealClasses(Game game) {
        return game.getStatus() == GameStatus.PLAYING || game.getStatus() == GameStatus.FINISHED;
    }

    /** Obstacles are public; hidden cells are NEVER in this view (req #44). */
    private GameStateResponse.FieldStateView buildFieldStateView(List<FieldCell> fieldCells,
                                                                 FieldState fieldState) {
        List<GameStateResponse.Cell> obstacles = new ArrayList<>();
        for (FieldCell cell : fieldCells) {
            if (cell.getCellKind() == FieldCellKind.OBSTACLE) {
                obstacles.add(new GameStateResponse.Cell(cell.getRow(), cell.getCol()));
            }
        }
        return new GameStateResponse.FieldStateView(
                fieldState.getFieldType().name(),
                obstacles,
                fieldState.getErodedRows(),
                fieldState.isTideTriggered(),
                fieldState.getRoundCounter(),
                fieldState.getSeaSide() == null ? null : fieldState.getSeaSide().name());
    }

    /**
     * Hidden cells become visible only after having been triggered while the game is
     * in progress (req #44). Once the game is FINISHED, ALL hidden cells (triggered or
     * not) are revealed for post-game review (req #44 #47, specs/ui/對局結束畫面.md:20).
     */
    private List<GameStateResponse.HiddenCellView> buildRevealedHiddenCells(
            List<FieldCell> fieldCells, boolean gameFinished) {
        List<GameStateResponse.HiddenCellView> revealed = new ArrayList<>();
        for (FieldCell cell : fieldCells) {
            if (cell.getCellKind() == FieldCellKind.OBSTACLE) {
                continue;
            }
            if (gameFinished || cell.isTriggered()) {
                revealed.add(new GameStateResponse.HiddenCellView(
                        cell.getCellKind().name(), cell.getRow(), cell.getCol()));
            }
        }
        return revealed;
    }

    // ────────────────────────── shared helpers ───────────────────────────────

    /** Rebuild the authoritative board from the immutable event streams. */
    @Transactional(readOnly = true)
    public SeriousBoard rebuildBoard(Game game, int size, List<FieldCell> fieldCells) {
        List<Move> moves = moveRepository.findByGameIdOrderByMoveNumberAsc(game.getId());
        List<FieldEvent> events = fieldEventRepository.findByGameIdOrderByOccurredAtAscIdAsc(game.getId());
        return BoardReplayer.rebuild(size, fieldCells, moves, events, objectMapper);
    }

    private FieldState requireFieldState(String gameId) {
        return fieldStateRepository.findByGameIdAndDeletedFalse(gameId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNPROCESSABLE, "場地狀態不存在"));
    }

    private void persistEvents(Settlement s) {
        Instant base = Instant.now();
        int i = 0;
        for (PendingEvent e : s.events) {
            FieldEvent entity = new FieldEvent();
            entity.setGameId(s.game.getId());
            entity.setMoveNumber(s.settleMoveNumber);
            entity.setEventType(e.type);
            entity.setRow(e.row);
            entity.setCol(e.col);
            entity.setDetail(e.detailJson(objectMapper));
            // Strictly increasing timestamps keep replay ordering deterministic
            // (PG TIMESTAMP has microsecond precision).
            entity.setOccurredAt(base.plusNanos(1000L * i++));
            fieldEventRepository.save(entity);
        }
    }

    /** Working state of one hand's settlement. */
    private static final class Settlement {
        final Game game;
        final SeriousBoard board;
        final List<FieldCell> fieldCells;
        final FieldState fieldState;
        final StoneColor actor;
        final List<int[]> placements = new ArrayList<>();
        final List<PendingEvent> events = new ArrayList<>();
        int settleMoveNumber;

        Settlement(Game game, SeriousBoard board, List<FieldCell> fieldCells,
                   FieldState fieldState, StoneColor actor) {
            this.game = game;
            this.board = board;
            this.fieldCells = fieldCells;
            this.fieldState = fieldState;
            this.actor = actor;
        }

        void addEvent(FieldEventType type, Integer row, Integer col, FieldEventDetail detail) {
            events.add(new PendingEvent(type, row, col, detail));
        }
    }

    private record PendingEvent(FieldEventType type, Integer row, Integer col, FieldEventDetail detail) {
        String detailJson(ObjectMapper objectMapper) {
            if (detail == null) {
                return null;
            }
            try {
                return objectMapper.writeValueAsString(detail);
            } catch (Exception e) {
                throw new IllegalStateException("Cannot serialize field event detail", e);
            }
        }
    }

    private FieldCell findUntriggeredHidden(List<FieldCell> fieldCells, int row, int col) {
        for (FieldCell cell : fieldCells) {
            if (cell.getRow() == row && cell.getCol() == col
                    && cell.getCellKind() != FieldCellKind.OBSTACLE && !cell.isTriggered()) {
                return cell;
            }
        }
        return null;
    }
}
