package com.gomoku.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.domain.entity.Player;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveEncounterEvent;
import com.gomoku.domain.entity.PveEncounterMove;
import com.gomoku.domain.entity.PveFieldCell;
import com.gomoku.domain.entity.PveFieldState;
import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.entity.PveRunRelic;
import com.gomoku.domain.entity.PveRunSkill;
import com.gomoku.domain.enums.BattleContext;
import com.gomoku.domain.enums.ClassType;
import com.gomoku.domain.enums.EffectActionType;
import com.gomoku.domain.enums.EffectUsageLimitType;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.PlayerType;
import com.gomoku.domain.enums.PveEncounterEventType;
import com.gomoku.domain.enums.PveEncounterStatus;
import com.gomoku.domain.enums.PveFieldType;
import com.gomoku.domain.enums.PveMutationType;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.PveRunStatus;
import com.gomoku.domain.enums.SkillDirection;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.dto.request.PveMoveCreateRequest;
import com.gomoku.dto.request.PveRunCreateRequest;
import com.gomoku.dto.request.PveSkillUseRequest;
import com.gomoku.dto.response.PveEncounterStateResponse;
import com.gomoku.dto.response.PveRunResultResponse;
import com.gomoku.dto.response.PveRunStateResponse;
import com.gomoku.exception.BusinessException;
import com.gomoku.exception.ErrorCode;
import com.gomoku.game.FieldGeometry;
import com.gomoku.game.PushResolver;
import com.gomoku.game.PveBoardReplayer;
import com.gomoku.game.PveEventDetail;
import com.gomoku.game.PveFieldGeometry;
import com.gomoku.game.PveFieldScheduler;
import com.gomoku.game.PveLineScanner;
import com.gomoku.game.PveRandoms;
import com.gomoku.game.SeriousBoard;
import com.gomoku.repository.EffectDefinitionRepository;
import com.gomoku.repository.PlayerRepository;
import com.gomoku.repository.PveEncounterEventRepository;
import com.gomoku.repository.PveEncounterMoveRepository;
import com.gomoku.repository.PveEncounterRepository;
import com.gomoku.repository.PveFieldCellRepository;
import com.gomoku.repository.PveFieldStateRepository;
import com.gomoku.repository.PveRunRelicRepository;
import com.gomoku.repository.PveRunRepository;
import com.gomoku.repository.PveRunSkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * PVE challenge engine (documents/PVE-挑戰模式-增量需求.md):
 *  - run lifecycle: create / current / abandon (FR-B1 FR-C7 FR-C8);
 *  - encounter settlement: placement -> hidden-cell triggers -> wave ->
 *    line resolution (relics, mutations) -> rage -> win/lose judgement
 *    (FR-B2/B3/B4, FR-C5, FR-C6);
 *  - skills as data-declared INDEPENDENT + CONSUMABLE actions (FR-A2 FR-B5).
 * Board convention: player stones BLACK, abyss obstacle stones WHITE,
 * volcano obstacles = obstacle mask (see PveBoardReplayer).
 */
@Service
public class PveChallengeService {

    private static final BigDecimal METRONOME_STEP = new BigDecimal("0.10");

    private final PveRunRepository runRepository;
    private final PveEncounterRepository encounterRepository;
    private final PveEncounterMoveRepository moveRepository;
    private final PveFieldCellRepository fieldCellRepository;
    private final PveFieldStateRepository fieldStateRepository;
    private final PveEncounterEventRepository eventRepository;
    private final PveRunSkillRepository skillRepository;
    private final PveRunRelicRepository relicRepository;
    private final PlayerRepository playerRepository;
    private final EffectDefinitionRepository effectDefinitionRepository;
    private final PveShopOfferDrawer offerDrawer;
    private final ObjectMapper objectMapper;

    public PveChallengeService(PveRunRepository runRepository,
                               PveEncounterRepository encounterRepository,
                               PveEncounterMoveRepository moveRepository,
                               PveFieldCellRepository fieldCellRepository,
                               PveFieldStateRepository fieldStateRepository,
                               PveEncounterEventRepository eventRepository,
                               PveRunSkillRepository skillRepository,
                               PveRunRelicRepository relicRepository,
                               PlayerRepository playerRepository,
                               EffectDefinitionRepository effectDefinitionRepository,
                               PveShopOfferDrawer offerDrawer,
                               ObjectMapper objectMapper) {
        this.runRepository = runRepository;
        this.encounterRepository = encounterRepository;
        this.moveRepository = moveRepository;
        this.fieldCellRepository = fieldCellRepository;
        this.fieldStateRepository = fieldStateRepository;
        this.eventRepository = eventRepository;
        this.skillRepository = skillRepository;
        this.relicRepository = relicRepository;
        this.playerRepository = playerRepository;
        this.effectDefinitionRepository = effectDefinitionRepository;
        this.offerDrawer = offerDrawer;
        this.objectMapper = objectMapper;
    }

    // ────────────────────────── run lifecycle ────────────────────────────────

    @Transactional
    public PveRunStateResponse createRun(String playerId, PveRunCreateRequest req) {
        Player player = playerRepository.findById(playerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (player.getPlayerType() == PlayerType.GUEST) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "PVE挑戰模式僅限已登入玩家");
        }
        if (runRepository.existsByPlayerIdAndStatusAndDeletedFalse(playerId, PveRunStatus.IN_PROGRESS)) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "已有進行中的Run，須先結束才能建立新Run");
        }

        PveRun run = new PveRun();
        run.setPlayerId(playerId);
        run.setClassType(req.classType());
        run.setSeed(req.seed() != null && !req.seed().isBlank() ? req.seed() : UUID.randomUUID().toString());
        runRepository.save(run);

        // Starter skill by class (FR-B5).
        SkillType starter = (req.classType() == ClassType.WARRIOR)
                ? SkillType.HORIZONTAL_SLASH : SkillType.PRECISION_SNIPE;
        PveRunSkill skill = new PveRunSkill();
        skill.setRunId(run.getId());
        skill.setSkillType(starter);
        skill.setQuantity(1);
        skillRepository.save(skill);

        createEncounter(run, 1);
        return buildRunState(run);
    }

    @Transactional(readOnly = true)
    public PveRunStateResponse getCurrentRun(String playerId) {
        PveRun run = runRepository
                .findFirstByPlayerIdAndStatusAndDeletedFalse(playerId, PveRunStatus.IN_PROGRESS)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "無進行中的Run"));
        return buildRunState(run);
    }

    @Transactional
    public PveRunResultResponse abandonRun(String playerId, String runId) {
        PveRun run = requireOwnedRun(playerId, runId);
        if (run.getStatus() != PveRunStatus.IN_PROGRESS) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "Run已結束");
        }
        run.setStatus(PveRunStatus.ABANDONED);
        run.setEndedAt(Instant.now());
        runRepository.save(run);
        return buildRunResult(run);
    }

    /**
     * GET /pve/runs/{runId}/result — operationId: getPveRunResult (FR-C7).
     * Only queryable once the run has naturally ended (WON/LOST/ABANDONED);
     * an in-progress run has no authoritative settlement yet.
     */
    @Transactional(readOnly = true)
    public PveRunResultResponse getRunResult(String playerId, String runId) {
        PveRun run = requireOwnedRun(playerId, runId);
        if (run.getStatus() == PveRunStatus.IN_PROGRESS) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "Run仍進行中，尚未結束");
        }
        return buildRunResult(run);
    }

    // ────────────────────────── encounter reads ──────────────────────────────

    @Transactional(readOnly = true)
    public PveEncounterStateResponse getEncounter(String playerId, String encounterId) {
        PveEncounter encounter = requireEncounter(encounterId);
        requireOwnedRun(playerId, encounter.getRunId());
        return buildEncounterState(encounter, null, List.of());
    }

    // ────────────────────────── placement settlement ──────────────────────────

    @Transactional
    public PveEncounterStateResponse placeMove(String playerId, String encounterId, PveMoveCreateRequest req) {
        PveEncounter encounter = requireEncounter(encounterId);
        PveRun run = requireOwnedRun(playerId, encounter.getRunId());
        if (encounter.getStatus() != PveEncounterStatus.IN_PROGRESS) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "關卡已結束");
        }
        if (encounter.getMovesUsed() >= encounter.getMoveBudget()) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "手數已用盡");
        }

        Settlement s = loadSettlement(run, encounter);
        int row = req.row();
        int col = req.col();
        if (!s.board.inBounds(row, col)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "座標超出棋盤範圍");
        }
        if (s.board.isObstacle(row, col)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "該格為障礙物，禁止落子");
        }
        if (s.board.hasStone(row, col)) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "該位置已有棋子");
        }

        int encounterMoveNumber = encounter.getMovesUsed() + 1;
        int runMoveNumber = priorRunMoves(run, encounter) + encounterMoveNumber;

        s.board.setStone(row, col, StoneColor.BLACK);
        PveEncounterMove move = new PveEncounterMove();
        move.setEncounterId(encounter.getId());
        move.setEncounterMoveNumber(encounterMoveNumber);
        move.setRunMoveNumber(runMoveNumber);
        move.setRow(row);
        move.setCol(col);
        moveRepository.save(move);
        encounter.setMovesUsed(encounterMoveNumber);
        s.settleMoveNumber = encounterMoveNumber;

        // Metronome: run-cumulative placement count; every 5th adds +0.1 forever (FR-C5 #6).
        if (s.hasRelic(PveRelicType.METRONOME) && runMoveNumber % 5 == 0) {
            run.setMetronomeMultiplierBonus(run.getMetronomeMultiplierBonus().add(METRONOME_STEP));
        }

        resolveHiddenCell(s, row, col);
        resolveWave(s);
        resolveLines(s);

        // Rage mutation: every 5th placement erupts a random occupied cell (FR-C6).
        if (encounter.getMutationType() == PveMutationType.RAGE && encounterMoveNumber % 5 == 0) {
            resolveRageEruption(s, runMoveNumber);
        }

        return finishSettlement(s, playerId);
    }

    // ────────────────────────── skill settlement ──────────────────────────────

    @Transactional
    public PveEncounterStateResponse useSkill(String playerId, String encounterId, PveSkillUseRequest req) {
        PveEncounter encounter = requireEncounter(encounterId);
        PveRun run = requireOwnedRun(playerId, encounter.getRunId());
        if (encounter.getStatus() != PveEncounterStatus.IN_PROGRESS) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "關卡已結束");
        }
        SkillType type = req.skillType();

        PveRunSkill held = skillRepository
                .findByRunIdAndSkillTypeAndDeletedFalse(run.getId(), type)
                .filter(sk -> sk.getQuantity() > 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNPROCESSABLE, "未持有該技能"));

        // At most 1 skill per interval, keyed by completed-move count (FR-B5).
        if (eventRepository.existsByEncounterIdAndEventTypeAndMoveNumber(
                encounter.getId(), PveEncounterEventType.SKILL_USED, encounter.getMovesUsed())) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "本間隔已使用過技能");
        }

        // Data-driven declaration (FR-A2): PVE casts must be INDEPENDENT and the
        // CONSUMABLE limit drives the quantity decrement — not hardcoded per skill.
        var definition = effectDefinitionRepository
                .findByEffectKeyAndApplicableModeAndDeletedFalse(type.name(), BattleContext.PVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNPROCESSABLE, "技能效果定義不存在"));
        if (definition.getActionType() != EffectActionType.INDEPENDENT) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "該技能於PVE非獨立行動");
        }

        Settlement s = loadSettlement(run, encounter);
        s.settleMoveNumber = encounter.getMovesUsed();
        executeSkill(s, req);

        if (definition.getUsageLimitType() == EffectUsageLimitType.CONSUMABLE) {
            held.setQuantity(held.getQuantity() - 1);
            skillRepository.save(held);
        }

        resolveLines(s);
        // Abyss also reacts to skill-induced line resolutions (FR-C6) — handled
        // inside resolveLines.
        return finishSettlement(s, playerId);
    }

    private void executeSkill(Settlement s, PveSkillUseRequest req) {
        SkillType type = req.skillType();
        List<PveEventDetail.Cell> placed = new ArrayList<>();
        List<PveEventDetail.Cell> removed = new ArrayList<>();
        List<PveEventDetail.Cell> swapped = new ArrayList<>();

        switch (type) {
            case HORIZONTAL_SLASH -> {
                if (req.direction() != SkillDirection.UP && req.direction() != SkillDirection.DOWN) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "橫劈方向必須為上或下");
                }
                requireAnchor(req);
                slashPush(s, req.anchor().row(), req.anchor().col(), req.direction(), true);
            }
            case VERTICAL_SLASH -> {
                if (req.direction() != SkillDirection.LEFT && req.direction() != SkillDirection.RIGHT) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "縱劈方向必須為左或右");
                }
                requireAnchor(req);
                slashPush(s, req.anchor().row(), req.anchor().col(), req.direction(), false);
            }
            case PRECISION_SNIPE -> {
                if (req.target() == null || req.target().row() == null || req.target().col() == null) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "精準狙擊必須指定目標");
                }
                int r = req.target().row();
                int c = req.target().col();
                // PVE "enemy stone" = abyss obstacle stone (WHITE).
                if (!s.board.inBounds(r, c) || s.board.stoneAt(r, c) != StoneColor.WHITE) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "精準狙擊目標非現存敵方棋子");
                }
                s.board.setStone(r, c, StoneColor.BLACK);
                placed.add(new PveEventDetail.Cell(r, c, StoneColor.BLACK.name()));
            }
            case SCATTER_SHOT -> {
                if (req.anchor() == null || req.anchor().row() == null || req.anchor().col() == null
                        || req.secondStone() == null || req.secondStone().row() == null
                        || req.secondStone().col() == null) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "散射必須指定兩顆棋子座標");
                }
                int r1 = req.anchor().row();
                int c1 = req.anchor().col();
                int r2 = req.secondStone().row();
                int c2 = req.secondStone().col();
                if (Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) < 2) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "散射兩子不得在彼此九宮格內");
                }
                requireEmptyPlayable(s.board, r1, c1);
                requireEmptyPlayable(s.board, r2, c2);
                s.board.setStone(r1, c1, StoneColor.BLACK);
                s.board.setStone(r2, c2, StoneColor.BLACK);
                placed.add(new PveEventDetail.Cell(r1, c1, StoneColor.BLACK.name()));
                placed.add(new PveEventDetail.Cell(r2, c2, StoneColor.BLACK.name()));
            }
            case HEAVEN_EARTH_REVERSAL, PIONEER_STAR -> {
                requireAnchor(req);
                int ar = req.anchor().row();
                int ac = req.anchor().col();
                if (!s.board.inBounds(ar, ac)) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "座標超出棋盤範圍");
                }
                if (!s.board.isEmptyPlayable(ar, ac)) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "大絕錨點格必須為空格");
                }
                if (req.direction() == null) {
                    throw new BusinessException(ErrorCode.UNPROCESSABLE, "必須指定施法方向");
                }
                List<int[]> zone = FieldGeometry.ultimateZone(ar, ac, req.direction(), s.board.size());
                for (int[] cell : zone) {
                    StoneColor color = s.board.stoneAt(cell[0], cell[1]);
                    if (color == null) {
                        continue;
                    }
                    if (type == SkillType.HEAVEN_EARTH_REVERSAL) {
                        StoneColor flipped = (color == StoneColor.BLACK) ? StoneColor.WHITE : StoneColor.BLACK;
                        s.board.setStone(cell[0], cell[1], flipped);
                        swapped.add(new PveEventDetail.Cell(cell[0], cell[1], flipped.name()));
                    } else {
                        s.board.removeStone(cell[0], cell[1]);
                        removed.add(new PveEventDetail.Cell(cell[0], cell[1], color.name()));
                    }
                }
            }
        }

        s.addEvent(PveEncounterEventType.SKILL_USED, null, null,
                PveEventDetail.skill(type.name(),
                        placed.isEmpty() ? null : placed,
                        removed.isEmpty() ? null : removed,
                        swapped.isEmpty() ? null : swapped));
    }

    private void requireAnchor(PveSkillUseRequest req) {
        if (req.anchor() == null || req.anchor().row() == null || req.anchor().col() == null) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "必須指定施法錨點");
        }
        // Anchor may be any in-bounds reference cell for slashes; bounds checked
        // where geometry is derived.
    }

    private void requireEmptyPlayable(SeriousBoard board, int row, int col) {
        if (!board.inBounds(row, col)) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "座標超出棋盤範圍");
        }
        if (!board.isEmptyPlayable(row, col)) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "該位置已有棋子或為障礙格");
        }
    }

    /**
     * Slash push around an anchor reference cell: HORIZONTAL_SLASH pushes the
     * 3 adjacent cells (front + diagonals) 1 step; VERTICAL_SLASH pushes the
     * single adjacent cell. CHAIN_CORE adds +1 chain distance by pushing the
     * moved stones one more step (FR-C5 #2).
     */
    private void slashPush(Settlement s, int anchorRow, int anchorCol, SkillDirection dir, boolean horizontal) {
        if (!s.board.inBounds(anchorRow, anchorCol)) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "座標超出棋盤範圍");
        }
        List<int[]> sources = new ArrayList<>(3);
        if (horizontal) {
            for (int side = -1; side <= 1; side++) {
                int r = anchorRow + dir.dRow();
                int c = anchorCol + side;
                if (s.board.inBounds(r, c)) {
                    sources.add(new int[]{r, c});
                }
            }
        } else {
            int r = anchorRow;
            int c = anchorCol + dir.dCol();
            if (s.board.inBounds(r, c)) {
                sources.add(new int[]{r, c});
            }
        }
        PushResolver.Outcome outcome = PushResolver.push(s.board, sources, dir);
        recordPushOutcome(s, outcome);

        if (s.hasRelic(PveRelicType.CHAIN_CORE) && !outcome.pushed().isEmpty()) {
            List<int[]> second = outcome.pushed().stream()
                    .map(p -> new int[]{p.toRow(), p.toCol()})
                    .toList();
            recordPushOutcome(s, PushResolver.push(s.board, second, dir));
        }
    }

    // ────────────────────────── field effects ────────────────────────────────

    /** Hidden ERUPTION/TIDE cell triggers when a stone lands on it (FR-C2). */
    private void resolveHiddenCell(Settlement s, int row, int col) {
        PveFieldCell hidden = s.fieldCells.stream()
                .filter(c -> c.getRow() == row && c.getCol() == col
                        && c.getCellKind() != FieldCellKind.OBSTACLE && !c.isTriggered())
                .findFirst().orElse(null);
        if (hidden == null) {
            return;
        }
        hidden.setTriggered(true);
        hidden.setVisibleToPlayer(true);
        hidden.setTriggeredAt(Instant.now());
        fieldCellRepository.save(hidden);

        if (hidden.getCellKind() == FieldCellKind.ERUPTION) {
            List<PveEventDetail.Cell> burned = new ArrayList<>();
            int playerStonesBurned = 0;
            for (int[] n : eightNeighbors(row, col, s.board.size())) {
                StoneColor color = s.board.stoneAt(n[0], n[1]);
                if (color != null) {
                    s.board.removeStone(n[0], n[1]);
                    burned.add(new PveEventDetail.Cell(n[0], n[1], color.name()));
                    if (color == StoneColor.BLACK) {
                        playerStonesBurned++;
                    }
                }
            }
            s.addEvent(PveEncounterEventType.VOLCANO_ERUPTED, row, col,
                    PveEventDetail.removedCells(burned));
            // Volcano Heart: each eruption-cleared player stone deals 10 (FR-C5 #4).
            if (s.hasRelic(PveRelicType.VOLCANO_HEART)) {
                s.extraDamage += playerStonesBurned * 10;
            }
        } else if (hidden.getCellKind() == FieldCellKind.TIDE) {
            s.fieldState.setTideTriggered(true);
            s.addEvent(PveEncounterEventType.TIDE_TRIGGERED, row, col, null);
        }
    }

    /** BEACH wave: every 10 placements push ocean stones 1 step sandward (FR-C2). */
    private void resolveWave(Settlement s) {
        if (s.encounter.getFieldType() != PveFieldType.BEACH || s.fieldState.getSeaSide() == null) {
            return;
        }
        s.fieldState.setWaveMoveCounter(s.fieldState.getWaveMoveCounter() + 1);
        if (s.fieldState.getWaveMoveCounter() < PveFieldGeometry.WAVE_HANDS) {
            return;
        }
        s.fieldState.setWaveMoveCounter(0);
        s.addEvent(PveEncounterEventType.WAVE_SURGED, null, null, null);

        boolean breakwater = s.hasRelic(PveRelicType.TIDE_BREAKWATER);
        SkillDirection dir = PveFieldGeometry.wavePushDirection(s.fieldState.getSeaSide());
        List<int[]> sources = new ArrayList<>();
        for (int r = 0; r < s.board.size(); r++) {
            for (int c = 0; c < s.board.size(); c++) {
                if (!s.board.hasStone(r, c)) {
                    continue;
                }
                // Breakwater: the wave neither moves nor removes YOUR stones (FR-C5 #5).
                if (breakwater && s.board.stoneAt(r, c) == StoneColor.BLACK) {
                    continue;
                }
                if (PveFieldGeometry.isOcean(r, c, s.fieldState.getSeaSide(), s.fieldState.getErodedRows())) {
                    sources.add(new int[]{r, c});
                }
            }
        }
        recordPushOutcome(s, PushResolver.push(s.board, sources, dir));

        if (s.fieldState.isTideTriggered()
                && PveFieldGeometry.INITIAL_SEA_ROWS + s.fieldState.getErodedRows() < PveFieldGeometry.BOARD_SIZE) {
            s.fieldState.setErodedRows(s.fieldState.getErodedRows() + 1);
        }
    }

    /**
     * One scan pass resolving ALL current lines (FR-B2): each line settles its
     * own damage (FR-B3 + relics), shared stones are removed once, ONE_EYE
     * skips horizontal lines entirely, ABYSS spawns one obstacle stone per
     * resolved line, GEMINI_STAR doubles the hand total on >= 2 lines.
     */
    private void resolveLines(Settlement s) {
        List<PveLineScanner.Line> lines = PveLineScanner.scanAll(s.board, StoneColor.BLACK);
        List<PveLineScanner.Line> resolvable = lines.stream()
                .filter(line -> !(s.encounter.getMutationType() == PveMutationType.ONE_EYE
                        && line.direction() == PveLineScanner.Direction.HORIZONTAL))
                .toList();
        if (resolvable.isEmpty()) {
            return;
        }

        double baseMultiplier = 1.0 + s.run.getMetronomeMultiplierBonus().doubleValue();
        boolean sharpBlade = s.hasRelic(PveRelicType.SHARP_BLADE);
        boolean diagonalWalker = s.hasRelic(PveRelicType.DIAGONAL_WALKER);

        int handDamage = 0;
        Set<Long> unionCells = new LinkedHashSet<>();
        for (PveLineScanner.Line line : resolvable) {
            int base = 50 + 20 * (line.length() - 5) + (sharpBlade ? 20 : 0);
            boolean diagonal = line.direction() == PveLineScanner.Direction.DIAGONAL
                    || line.direction() == PveLineScanner.Direction.ANTI_DIAGONAL;
            double multiplier = baseMultiplier + (diagonalWalker && diagonal ? 0.5 : 0.0);
            int damage = (int) Math.floor(base * multiplier);
            handDamage += damage;

            List<PveEventDetail.Cell> cells = new ArrayList<>();
            for (int[] cell : line.cells()) {
                cells.add(new PveEventDetail.Cell(cell[0], cell[1], StoneColor.BLACK.name()));
                unionCells.add((long) cell[0] * 100 + cell[1]);
            }
            s.addEvent(PveEncounterEventType.LINE_RESOLVED,
                    line.cells().get(0)[0], line.cells().get(0)[1],
                    PveEventDetail.line(line.direction().name(), line.length(), base, multiplier, damage, cells));
            s.linesResolved.add(new PveEncounterStateResponse.LineView(
                    line.length(), base, multiplier, line.direction().name()));
        }

        if (s.hasRelic(PveRelicType.GEMINI_STAR) && resolvable.size() >= 2) {
            handDamage *= 2; // FR-C5 #8
        }
        s.lineDamage += handDamage;

        // Remove the union of resolved cells — shared stones once (FR-B2).
        for (long key : unionCells) {
            s.board.removeStone((int) (key / 100), (int) (key % 100));
        }
        s.removedByLinesThisSettle += unionCells.size();

        // Recycler: every 10 line-removed stones grant +1 move budget this
        // encounter (FR-C5 #7); recomputed from the authoritative event stream.
        if (s.hasRelic(PveRelicType.RECYCLER)) {
            int totalRemoved = pastLineRemovedCount(s.encounter.getId()) + s.removedByLinesThisSettle;
            s.encounter.setMoveBudget(PveFieldScheduler.MOVE_BUDGET + totalRemoved / 10);
        }

        // Abyss: one obstacle stone per resolved line (FR-C6).
        if (s.encounter.getMutationType() == PveMutationType.ABYSS) {
            for (int i = 0; i < resolvable.size(); i++) {
                spawnAbyssObstacle(s);
            }
        }
    }

    private void spawnAbyssObstacle(Settlement s) {
        List<int[]> empties = new ArrayList<>();
        for (int r = 0; r < s.board.size(); r++) {
            for (int c = 0; c < s.board.size(); c++) {
                if (s.board.isEmptyPlayable(r, c)) {
                    empties.add(new int[]{r, c});
                }
            }
        }
        if (empties.isEmpty()) {
            return;
        }
        int ordinal = s.abyssSpawnOrdinal++ + pastEventCount(s.encounter.getId(), PveEncounterEventType.BOSS_MUTATION_TRIGGERED);
        Random rng = PveRandoms.forPurpose(s.run.getSeed(), "abyss:" + ordinal);
        int[] cell = empties.get(rng.nextInt(empties.size()));
        s.board.setStone(cell[0], cell[1], StoneColor.WHITE);
        s.addEvent(PveEncounterEventType.BOSS_MUTATION_TRIGGERED, cell[0], cell[1],
                PveEventDetail.mutation("ABYSS", null, null));
    }

    /** Rage: erupt a random occupied cell, clearing it + 8 neighbors (FR-C6). */
    private void resolveRageEruption(Settlement s, int runMoveNumber) {
        List<int[]> occupied = new ArrayList<>();
        for (int r = 0; r < s.board.size(); r++) {
            for (int c = 0; c < s.board.size(); c++) {
                if (s.board.hasStone(r, c)) {
                    occupied.add(new int[]{r, c});
                }
            }
        }
        if (occupied.isEmpty()) {
            return;
        }
        occupied.sort(Comparator.comparingInt((int[] p) -> p[0] * 100 + p[1]));
        Random rng = PveRandoms.forPurpose(s.run.getSeed(), "rage:" + runMoveNumber);
        int[] center = occupied.get(rng.nextInt(occupied.size()));

        List<PveEventDetail.Cell> cleared = new ArrayList<>();
        int playerStonesCleared = 0;
        List<int[]> zone = new ArrayList<>();
        zone.add(center);
        zone.addAll(eightNeighbors(center[0], center[1], s.board.size()));
        for (int[] cell : zone) {
            StoneColor color = s.board.stoneAt(cell[0], cell[1]);
            if (color != null) {
                s.board.removeStone(cell[0], cell[1]);
                cleared.add(new PveEventDetail.Cell(cell[0], cell[1], color.name()));
                if (color == StoneColor.BLACK) {
                    playerStonesCleared++;
                }
            }
        }
        // No boss damage from the clear itself — except Volcano Heart (FR-C6).
        Integer heartDamage = null;
        if (s.hasRelic(PveRelicType.VOLCANO_HEART)) {
            heartDamage = playerStonesCleared * 10;
            s.extraDamage += heartDamage;
        }
        s.addEvent(PveEncounterEventType.BOSS_MUTATION_TRIGGERED, center[0], center[1],
                PveEventDetail.mutation("RAGE", cleared, heartDamage));
    }

    // ────────────────────────── judgement + persistence ──────────────────────

    private PveEncounterStateResponse finishSettlement(Settlement s, String playerId) {
        int totalDamage = s.lineDamage + s.extraDamage;
        if (totalDamage > 0) {
            s.encounter.setBossHpCurrent(Math.max(0, s.encounter.getBossHpCurrent() - totalDamage));
            s.run.setTotalDamageDealt(s.run.getTotalDamageDealt() + totalDamage);
        }

        if (s.encounter.getBossHpCurrent() <= 0) {
            s.addEvent(PveEncounterEventType.ENCOUNTER_CLEARED, null, null, null);
            onEncounterCleared(s.run, s.encounter);
        } else if (s.encounter.getMovesUsed() >= s.encounter.getMoveBudget()) {
            s.encounter.setStatus(PveEncounterStatus.FAILED);
            s.encounter.setFailedAt(Instant.now());
            s.addEvent(PveEncounterEventType.ENCOUNTER_FAILED, null, null, null);
            // Any failed encounter terminates the whole run (FR-C7).
            s.run.setStatus(PveRunStatus.LOST);
            s.run.setEndedAt(Instant.now());
        }

        persistEvents(s);
        fieldStateRepository.save(s.fieldState);
        encounterRepository.save(s.encounter);
        runRepository.save(s.run);

        PveEncounterStateResponse.Resolution resolution = new PveEncounterStateResponse.Resolution(
                totalDamage, List.copyOf(s.linesResolved));
        List<PveEncounterStateResponse.EventView> eventViews = s.events.stream()
                .map(e -> new PveEncounterStateResponse.EventView(e.type.name(), e.row, e.col))
                .toList();
        return buildEncounterState(s.encounter, resolution, eventViews);
    }

    /** Clear: award gold, advance reach, open shop or settle the run (FR-C3 FR-C4 FR-C7). */
    void onEncounterCleared(PveRun run, PveEncounter encounter) {
        encounter.setStatus(PveEncounterStatus.CLEARED);
        encounter.setClearedAt(Instant.now());

        int reward = 10 + (encounter.getMoveBudget() - encounter.getMovesUsed());
        run.setGold(run.getGold() + reward);
        run.setGoldEarned(run.getGoldEarned() + reward);
        run.setReachedEncounterSequence(Math.max(run.getReachedEncounterSequence(), encounter.getSequence()));

        if (encounter.getSequence() >= PveFieldScheduler.ENCOUNTER_COUNT) {
            run.setStatus(PveRunStatus.WON);
            run.setEndedAt(Instant.now());
        } else {
            offerDrawer.openShop(run, encounter.getSequence());
        }
    }

    /** Create + persist the encounter for {@code sequence} from the seed plan. */
    @Transactional
    public PveEncounter createEncounter(PveRun run, int sequence) {
        PveFieldScheduler.EncounterPlan plan = PveFieldScheduler.plan(run.getSeed(), sequence);
        PveEncounter encounter = new PveEncounter();
        encounter.setRunId(run.getId());
        encounter.setSequence(sequence);
        encounter.setFieldType(plan.fieldType());
        encounter.setMutationType(plan.mutationType());
        encounter.setBossHpMax(plan.bossHpMax());
        encounter.setBossHpCurrent(plan.bossHpMax());
        encounter.setMoveBudget(plan.moveBudget());
        encounterRepository.save(encounter);

        for (PveFieldScheduler.PlannedCell cell : plan.cells()) {
            PveFieldCell entity = new PveFieldCell();
            entity.setEncounterId(encounter.getId());
            entity.setCellKind(cell.kind());
            entity.setRow(cell.row());
            entity.setCol(cell.col());
            entity.setVisibleToPlayer(cell.visible());
            fieldCellRepository.save(entity);
        }

        PveFieldState state = new PveFieldState();
        state.setEncounterId(encounter.getId());
        state.setSeaSide(plan.seaSide());
        fieldStateRepository.save(state);
        return encounter;
    }

    // ────────────────────────── response building ────────────────────────────

    @Transactional(readOnly = true)
    public PveRunStateResponse buildRunState(PveRun run) {
        PveEncounter current = encounterRepository
                .findByRunIdAndSequenceAndDeletedFalse(run.getId(), run.getCurrentEncounterSequence())
                .orElse(null);
        return new PveRunStateResponse(
                run.getId(),
                run.getClassType().name(),
                run.getStatus().name(),
                run.getGold(),
                run.getCurrentEncounterSequence(),
                run.getReachedEncounterSequence(),
                run.getTotalDamageDealt(),
                current == null ? null : buildEncounterState(current, null, List.of()),
                heldSkills(run.getId()),
                heldRelics(run.getId()));
    }

    @Transactional(readOnly = true)
    public PveRunResultResponse buildRunResult(PveRun run) {
        return new PveRunResultResponse(
                run.getId(),
                run.getStatus().name(),
                run.getReachedEncounterSequence(),
                run.getTotalDamageDealt(),
                run.getGoldEarned(),
                run.getGoldSpent(),
                heldSkills(run.getId()),
                heldRelics(run.getId()));
    }

    PveEncounterStateResponse buildEncounterState(PveEncounter encounter,
                                                  PveEncounterStateResponse.Resolution resolution,
                                                  List<PveEncounterStateResponse.EventView> eventViews) {
        List<PveFieldCell> fieldCells = fieldCellRepository.findByEncounterIdAndDeletedFalse(encounter.getId());
        List<PveEncounterMove> moves = moveRepository.findByEncounterIdOrderByEncounterMoveNumberAsc(encounter.getId());
        List<PveEncounterEvent> events = eventRepository.findByEncounterIdOrderByOccurredAtAscIdAsc(encounter.getId());
        SeriousBoard board = PveBoardReplayer.rebuild(fieldCells, moves, events, objectMapper);

        List<PveEncounterStateResponse.Cell> stones = new ArrayList<>();
        List<PveEncounterStateResponse.Cell> obstacles = new ArrayList<>();
        for (int r = 0; r < board.size(); r++) {
            for (int c = 0; c < board.size(); c++) {
                if (board.stoneAt(r, c) == StoneColor.BLACK) {
                    stones.add(new PveEncounterStateResponse.Cell(r, c));
                } else if (board.stoneAt(r, c) == StoneColor.WHITE || board.isObstacle(r, c)) {
                    obstacles.add(new PveEncounterStateResponse.Cell(r, c));
                }
            }
        }

        boolean skillUsable = encounter.getStatus() == PveEncounterStatus.IN_PROGRESS
                && !eventRepository.existsByEncounterIdAndEventTypeAndMoveNumber(
                        encounter.getId(), PveEncounterEventType.SKILL_USED, encounter.getMovesUsed());

        List<String> usedSkills = events.stream()
                .filter(e -> e.getEventType() == PveEncounterEventType.SKILL_USED)
                .map(e -> {
                    try {
                        PveEventDetail detail = objectMapper.readValue(e.getDetail(), PveEventDetail.class);
                        return detail.skillType();
                    } catch (Exception ex) {
                        return null;
                    }
                })
                .filter(t -> t != null)
                .toList();

        return new PveEncounterStateResponse(
                encounter.getId(),
                encounter.getRunId(),
                encounter.getSequence(),
                encounter.getFieldType().name(),
                encounter.getMutationType().name(),
                encounter.getBoardRows(),
                encounter.getBoardCols(),
                encounter.getBossHpMax(),
                encounter.getBossHpCurrent(),
                encounter.getMoveBudget(),
                encounter.getMovesUsed(),
                encounter.getStatus().name(),
                stones,
                obstacles,
                skillUsable,
                resolution,
                eventViews,
                usedSkills);
    }

    private List<PveRunStateResponse.HeldSkill> heldSkills(String runId) {
        return skillRepository.findByRunIdAndDeletedFalse(runId).stream()
                .filter(sk -> sk.getQuantity() > 0)
                .map(sk -> new PveRunStateResponse.HeldSkill(sk.getSkillType().name(), sk.getQuantity()))
                .toList();
    }

    private List<PveRunStateResponse.HeldRelic> heldRelics(String runId) {
        return relicRepository.findByRunIdAndDeletedFalse(runId).stream()
                .map(r -> new PveRunStateResponse.HeldRelic(r.getRelicType().name()))
                .toList();
    }

    // ────────────────────────── shared helpers ───────────────────────────────

    PveRun requireOwnedRun(String playerId, String runId) {
        PveRun run = runRepository.findById(runId)
                .filter(r -> !r.isDeleted())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Run不存在"));
        if (!run.getPlayerId().equals(playerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "非本人的Run");
        }
        return run;
    }

    PveEncounter requireEncounter(String encounterId) {
        return encounterRepository.findById(encounterId)
                .filter(e -> !e.isDeleted())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "關卡不存在"));
    }

    private Settlement loadSettlement(PveRun run, PveEncounter encounter) {
        List<PveFieldCell> fieldCells = fieldCellRepository.findByEncounterIdAndDeletedFalse(encounter.getId());
        List<PveEncounterMove> moves = moveRepository.findByEncounterIdOrderByEncounterMoveNumberAsc(encounter.getId());
        List<PveEncounterEvent> events = eventRepository.findByEncounterIdOrderByOccurredAtAscIdAsc(encounter.getId());
        SeriousBoard board = PveBoardReplayer.rebuild(fieldCells, moves, events, objectMapper);
        PveFieldState fieldState = fieldStateRepository.findByEncounterIdAndDeletedFalse(encounter.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNPROCESSABLE, "場地狀態不存在"));
        Set<PveRelicType> relics = new LinkedHashSet<>();
        for (PveRunRelic relic : relicRepository.findByRunIdAndDeletedFalse(run.getId())) {
            relics.add(relic.getRelicType());
        }
        return new Settlement(run, encounter, board, fieldCells, fieldState, relics);
    }

    private int priorRunMoves(PveRun run, PveEncounter current) {
        return encounterRepository.findByRunIdAndDeletedFalseOrderBySequenceAsc(run.getId()).stream()
                .filter(e -> !e.getId().equals(current.getId()))
                .mapToInt(PveEncounter::getMovesUsed)
                .sum();
    }

    private int pastLineRemovedCount(String encounterId) {
        int count = 0;
        for (PveEncounterEvent event : eventRepository
                .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(encounterId, PveEncounterEventType.LINE_RESOLVED)) {
            try {
                PveEventDetail detail = objectMapper.readValue(event.getDetail(), PveEventDetail.class);
                if (detail.cells() != null) {
                    count += detail.cells().size();
                }
            } catch (Exception ignored) {
                // malformed detail — skip
            }
        }
        return count;
    }

    private int pastEventCount(String encounterId, PveEncounterEventType type) {
        return eventRepository.findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(encounterId, type).size();
    }

    private void recordPushOutcome(Settlement s, PushResolver.Outcome outcome) {
        // Off-board removals FIRST so replay stays order-correct (see PveBoardReplayer).
        for (PushResolver.Removed r : outcome.removed()) {
            s.addEvent(PveEncounterEventType.STONE_REMOVED_OFF_BOARD, r.row(), r.col(), null);
        }
        if (!outcome.pushed().isEmpty()) {
            List<PveEventDetail.Push> pushes = outcome.pushed().stream()
                    .map(p -> new PveEventDetail.Push(p.fromRow(), p.fromCol(), p.toRow(), p.toCol(), p.color().name()))
                    .toList();
            s.addEvent(PveEncounterEventType.STONES_PUSHED, null, null, PveEventDetail.pushes(pushes));
        }
    }

    private void persistEvents(Settlement s) {
        Instant base = Instant.now();
        int i = 0;
        for (PendingEvent e : s.events) {
            PveEncounterEvent entity = new PveEncounterEvent();
            entity.setEncounterId(s.encounter.getId());
            entity.setMoveNumber(s.settleMoveNumber);
            entity.setEventType(e.type);
            entity.setRow(e.row);
            entity.setCol(e.col);
            entity.setDetail(e.detailJson(objectMapper));
            entity.setOccurredAt(base.plusNanos(1000L * i++));
            eventRepository.save(entity);
        }
    }

    private static List<int[]> eightNeighbors(int row, int col, int size) {
        List<int[]> cells = new ArrayList<>(8);
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                if (dr == 0 && dc == 0) {
                    continue;
                }
                int r = row + dr;
                int c = col + dc;
                if (r >= 0 && r < size && c >= 0 && c < size) {
                    cells.add(new int[]{r, c});
                }
            }
        }
        return cells;
    }

    /** Working state of one settlement (a placement or a skill cast). */
    private static final class Settlement {
        final PveRun run;
        final PveEncounter encounter;
        final SeriousBoard board;
        final List<PveFieldCell> fieldCells;
        final PveFieldState fieldState;
        final Set<PveRelicType> relics;
        final List<PendingEvent> events = new ArrayList<>();
        final List<PveEncounterStateResponse.LineView> linesResolved = new ArrayList<>();
        int settleMoveNumber;
        int lineDamage = 0;
        int extraDamage = 0;
        int removedByLinesThisSettle = 0;
        int abyssSpawnOrdinal = 0;

        Settlement(PveRun run, PveEncounter encounter, SeriousBoard board,
                   List<PveFieldCell> fieldCells, PveFieldState fieldState, Set<PveRelicType> relics) {
            this.run = run;
            this.encounter = encounter;
            this.board = board;
            this.fieldCells = fieldCells;
            this.fieldState = fieldState;
            this.relics = relics;
        }

        boolean hasRelic(PveRelicType type) {
            return relics.contains(type);
        }

        void addEvent(PveEncounterEventType type, Integer row, Integer col, PveEventDetail detail) {
            events.add(new PendingEvent(type, row, col, detail));
        }
    }

    private record PendingEvent(PveEncounterEventType type, Integer row, Integer col, PveEventDetail detail) {
        String detailJson(ObjectMapper objectMapper) {
            if (detail == null) {
                return null;
            }
            try {
                return objectMapper.writeValueAsString(detail);
            } catch (Exception e) {
                throw new IllegalStateException("Cannot serialize pve event detail", e);
            }
        }
    }
}
