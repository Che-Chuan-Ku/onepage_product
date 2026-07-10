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
import com.gomoku.domain.enums.PveEncounterType;
import com.gomoku.domain.enums.PveFieldType;
import com.gomoku.domain.enums.PveMinorDisruptionType;
import com.gomoku.domain.enums.PveMutationType;
import com.gomoku.domain.enums.PveOpeningScript;
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
import com.gomoku.game.BossAiPolicy;
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

        if (encounter.getEncounterType() == PveEncounterType.DUEL) {
            // §1.5/§5.1: DUEL has no damage/mutation/field-effect settlement at
            // all — pure five-in-a-row judgement, then the boss's free reply.
            return settleDuel(s, playerId, true, row, col);
        }

        // Metronome: run-cumulative placement count; every 5th adds +0.1 forever (FR-C5 #6).
        if (s.hasRelic(PveRelicType.METRONOME) && runMoveNumber % 5 == 0) {
            run.setMetronomeMultiplierBonus(run.getMetronomeMultiplierBonus().add(METRONOME_STEP));
        }

        resolveHiddenCell(s, row, col);
        resolveWave(s);
        resolveLines(s);

        // Rage mutation: every 3rd placement erupts a random occupied cell (FR-C6).
        // 2026-07-09 調校輪2（互動命中率）: 每5手→每3手，見resolveRageEruption class doc。
        if (encounter.getMutationType() == PveMutationType.RAGE && encounterMoveNumber % 3 == 0) {
            resolveRageEruption(s, runMoveNumber);
        }
        // Minor disruption: single-shot variety on non-mutation encounters (§5).
        resolveMinorDisruption(s, encounterMoveNumber);

        return finishSettlement(s, playerId);
    }

    // ────────────────────────── DUEL settlement (2026-07-09 魔王對弈設計 §1.5/§5.1) ──

    /**
     * Shared DUEL settlement for both {@link #placeMove} and {@link
     * #useSkill}: check the player's own five-in-a-row first (CLEARED wins
     * outright, same as any other win); if not won and {@code allowBossMove}
     * (placeMove only — §1.6 explicitly forbids the boss replying to a skill
     * cast), either the boss replies (scripted opening move on its very first
     * reply, then {@link BossAiPolicy} from then on) or — if the player's own
     * move budget is exhausted without a win — the encounter FAILS.
     */
    private PveEncounterStateResponse settleDuel(Settlement s, String playerId,
                                                 boolean allowBossMove, Integer justPlacedRow, Integer justPlacedCol) {
        PveEncounter encounter = s.encounter;
        PveRun run = s.run;
        int sequence = encounter.getSequence();

        if (allowBossMove) {
            // §4.3 L6 海浪（documents/PVE-全對弈階梯設計-2026-07-10.md）: the
            // player's own hand also counts toward the WAVE_HANDS cadence —
            // resolveWave is itself a no-op unless fieldType==BEACH (L6 only).
            // Order matters: 落子→推浪→勝負判定 — a five completed THIS hand
            // can still be broken up by a wave that fires on this exact hand.
            resolveWave(s);
        }

        if (hasWinningLine(s.board, StoneColor.BLACK, sequence)) {
            s.addEvent(PveEncounterEventType.ENCOUNTER_CLEARED, null, null, null);
            onEncounterCleared(run, encounter);
        } else if (allowBossMove && (encounter.getMovesUsed() >= encounter.getMoveBudget() || s.board.isFull())) {
            // isFull(): no legal cell left for the boss to reply with at all
            // — an extremely rare, non-decisive near-full-board game (only
            // possible with a very generous moveBudget relative to the 121-
            // cell board). Treated the same as moves-exhausted.
            //
            // 2026-07-09 §1.5/§6.5 公平性修正: this used to be FAILED (whole
            // run forfeited, LOST) — but only the PLAYER has a move budget;
            // the boss replies for free every turn, so "neither side got
            // five-in-a-row before the player's budget ran out" pinned 100%
            // of the blame on the player for a genuinely fair, mistake-free
            // stalemate. Now: DRAW, not FAILED — the run is NOT forfeited
            // (stays IN_PROGRESS) and the level is retryable in place via
            // retryDuelEncounter (§5.1 diff), an unlimited number of times,
            // each attempt reshuffling the boss-AI RNG stream (see duelRunSeed).
            encounter.setStatus(PveEncounterStatus.DRAW);
            encounter.setDrawnAt(Instant.now());
            s.addEvent(PveEncounterEventType.ENCOUNTER_DRAWN, null, null, null);
        } else if (allowBossMove) {
            int bossMoveOrdinal = bossTurnOrdinal(encounter.getId(), sequence);
            boolean horizontalDisabled = sequence == 3; // §4.1 L3-only 不可橫向
            if (bossMoveOrdinal == 0 && encounter.getOpeningScript() != PveOpeningScript.NONE) {
                int[] bossMove = BossAiPolicy.openingMove(encounter.getOpeningScript(), justPlacedRow, justPlacedCol);
                s.board.setStone(bossMove[0], bossMove[1], StoneColor.WHITE);
                s.addEvent(PveEncounterEventType.BOSS_MOVE_PLACED, bossMove[0], bossMove[1], null);
            } else if (sequence == 8) {
                // L8 "SKILL_DEMON" (§3): skill-aware decision — may substitute
                // a one-shot skill cast for the plain placement (§3.2: 施法
                // 佔用Boss的整手，不額外疊加落子).
                BossAiPolicy.SkillCharges charges = new BossAiPolicy.SkillCharges(
                        !encounter.isBossPioneerUsed(), !encounter.isBossSniperUsed(), !encounter.isBossScatterUsed());
                // §1 狙擊閉四combo修正: profileFor(8)==TRUE_DEMON always, so this
                // only gates on the player's own unused PRECISION_SNIPE charge
                // (see BossAiPolicy#nextAction's skillAwareDefense javadoc).
                boolean skillAwareDefense = playerHasUnusedSniperCharge(run);
                BossAiPolicy.ActionDecision decision = BossAiPolicy.nextAction(s.board,
                        BossAiPolicy.profileFor(sequence), duelRunSeed(run, encounter), sequence,
                        bossMoveOrdinal + 1, horizontalDisabled, charges,
                        bossSkillCooldowns(encounter.getId(), bossMoveOrdinal + 1), skillAwareDefense);
                if (decision.action() instanceof BossAiPolicy.BossAction.CastSkill cast) {
                    executeBossSkill(s, cast, encounter);
                } else if (decision.action() instanceof BossAiPolicy.BossAction.PlaceStone place) {
                    s.board.setStone(place.row(), place.col(), StoneColor.WHITE);
                    s.addEvent(PveEncounterEventType.BOSS_MOVE_PLACED, place.row(), place.col(),
                            PveEventDetail.aiAudit(decision.audit()));
                }
            } else {
                BossAiPolicy.Profile profile = BossAiPolicy.profileFor(sequence);
                // §1 狙擊閉四combo修正: skill-aware defense gated to TRUE_DEMON
                // (L7 here; NOVICE/APPRENTICE/ELITE never qualify — L1-L6 不感知)
                // AND the player still holding an unused PRECISION_SNIPE charge.
                boolean skillAwareDefense = profile == BossAiPolicy.Profile.TRUE_DEMON
                        && playerHasUnusedSniperCharge(run);
                // §7.6 L1 NOVICE 腳本化教學漏擋: the encounter's first
                // NOVICE_TEACHING_FORCED_BLOCKS faced player open-threes must
                // be hard-blocked; the count is derived from persisted
                // aiFacedOpenThree audit flags — only then may the 45%
                // leniency dice start.
                boolean teachingForceBlock = profile == BossAiPolicy.Profile.NOVICE
                        && bossFacedOpenThreeCount(encounter.getId()) < BossAiPolicy.NOVICE_TEACHING_FORCED_BLOCKS;
                BossAiPolicy.Decision decision = BossAiPolicy.decideMove(s.board, profile,
                        duelRunSeed(run, encounter), sequence, bossMoveOrdinal + 1, horizontalDisabled,
                        skillAwareDefense, teachingForceBlock);
                int[] bossMove = decision.move();
                s.board.setStone(bossMove[0], bossMove[1], StoneColor.WHITE);
                s.addEvent(PveEncounterEventType.BOSS_MOVE_PLACED, bossMove[0], bossMove[1],
                        PveEventDetail.aiAudit(decision.audit()));
            }

            // §4.3 L6: the boss's own hand ALSO counts toward the wave cadence
            // (每一手都會計入，玩家與Boss合計10手＝各5手).
            resolveWave(s);

            if (hasWinningLine(s.board, StoneColor.WHITE, sequence)) {
                encounter.setStatus(PveEncounterStatus.FAILED);
                encounter.setFailedAt(Instant.now());
                s.addEvent(PveEncounterEventType.ENCOUNTER_FAILED, null, null, PveEventDetail.failReason("BOSS_FIVE"));
                run.setStatus(PveRunStatus.LOST);
                run.setEndedAt(Instant.now());
            } else if (s.board.isFull()) {
                // §4.2 L5 edge case: static VOLCANO rocks shrink the playable
                // area below the full 121 cells, so a long-grinding game can
                // fill the ENTIRE board on the BOSS's own move (not just the
                // player's, which the pre-boss-turn exhaustion check above
                // already covers) without either side ever completing a
                // five-in-a-row. Without this check the encounter would
                // silently stay IN_PROGRESS with no legal cell left for
                // anyone — the client-side board reconstruction would then
                // find zero empty cells on its NEXT move computation, which
                // is a hard, unrecoverable state (not just an inconvenience).
                encounter.setStatus(PveEncounterStatus.DRAW);
                encounter.setDrawnAt(Instant.now());
                s.addEvent(PveEncounterEventType.ENCOUNTER_DRAWN, null, null, null);
            }
        }
        // else: a skill cast (allowBossMove=false) that neither won nor lost —
        // stays IN_PROGRESS, no boss reply (§1.6).

        persistEvents(s);
        encounterRepository.save(encounter);
        runRepository.save(run);

        PveEncounterStateResponse.Resolution resolution = new PveEncounterStateResponse.Resolution(0, List.of());
        List<PveEncounterStateResponse.EventView> eventViews = s.events.stream()
                .map(e -> new PveEncounterStateResponse.EventView(e.type.name(), e.row, e.col))
                .toList();
        return buildEncounterState(encounter, resolution, eventViews, s.bossSkillEvents);
    }

    /**
     * The ACTUAL win judgement for a DUEL encounter (documents/PVE-全對弈階梯
     * 設計-2026-07-10.md §4.1 不可橫向): a five-in-a-row of {@code color}
     * exists, EXCLUDING any line whose sole qualifying direction is HORIZONTAL
     * when {@code sequence==3} (L3's twist — the only place in the whole
     * ladder this restriction applies, and it is symmetric: both the player
     * and the boss are subject to it). A simultaneous non-horizontal line
     * still counts, so a player/boss with BOTH a horizontal five AND e.g. a
     * vertical five on the same board still wins on the vertical one.
     */
    private boolean hasWinningLine(SeriousBoard board, StoneColor color, int sequence) {
        boolean horizontalDisabled = sequence == 3;
        for (PveLineScanner.Line line : PveLineScanner.scanAll(board, color)) {
            if (line.length() >= 5 && !(horizontalDisabled && line.direction() == PveLineScanner.Direction.HORIZONTAL)) {
                return true;
            }
        }
        return false;
    }

    /**
     * How many boss "turns" (a plain placement OR a L8 skill cast) have
     * already occurred this encounter — used both to detect "is this the
     * boss's very first reply" (opening script) and to scope each turn's
     * BossAiPolicy RNG purpose string. For sequences other than 8 this is
     * simply the BOSS_MOVE_PLACED count (a boss skill cast never happens
     * there); L8 additionally counts SKILL_USED events this service itself
     * marked caster="BOSS" (see {@link #executeBossSkill}) — a boss skill
     * cast REPLACES that turn's placement (§3.2), so without also counting it
     * here two consecutive boss turns could silently reuse the same RNG
     * purpose string (a determinism bug, not just a cosmetic one).
     */
    private int bossTurnOrdinal(String encounterId, int sequence) {
        int placed = pastEventCount(encounterId, PveEncounterEventType.BOSS_MOVE_PLACED);
        if (sequence != 8) {
            return placed;
        }
        int bossSkillCasts = 0;
        for (PveEncounterEvent event : eventRepository
                .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(encounterId, PveEncounterEventType.SKILL_USED)) {
            try {
                PveEventDetail detail = objectMapper.readValue(event.getDetail(), PveEventDetail.class);
                if ("BOSS".equals(detail.caster())) {
                    bossSkillCasts++;
                }
            } catch (Exception ignored) {
                // malformed detail — skip
            }
        }
        return placed + bossSkillCasts;
    }

    /**
     * Per-skill (§7.6 冷卻再議) and any-cast boss-turn distances since the
     * boss's most recent skill cast(s) this encounter — {@code
     * Integer.MAX_VALUE} where never cast. Derived by replaying the
     * encounter's ordered event log (BOSS_MOVE_PLACED and caster="BOSS"
     * SKILL_USED events each count as one boss turn, same numbering as
     * {@link #bossTurnOrdinal}), so no schema change is needed for either
     * cooldown policy (see {@link BossAiPolicy#nextAction}'s javadoc).
     */
    private BossAiPolicy.SkillCooldowns bossSkillCooldowns(String encounterId, int currentTurnNumber) {
        int turn = 0;
        int lastAnyCastTurn = -1;
        int lastPioneerTurn = -1;
        int lastSniperTurn = -1;
        int lastScatterTurn = -1;
        for (PveEncounterEvent event : eventRepository.findByEncounterIdOrderByOccurredAtAscIdAsc(encounterId)) {
            if (event.getEventType() == PveEncounterEventType.BOSS_MOVE_PLACED) {
                turn++;
            } else if (event.getEventType() == PveEncounterEventType.SKILL_USED) {
                try {
                    PveEventDetail detail = objectMapper.readValue(event.getDetail(), PveEventDetail.class);
                    if ("BOSS".equals(detail.caster())) {
                        turn++;
                        lastAnyCastTurn = turn;
                        switch (detail.skillType() == null ? "" : detail.skillType()) {
                            case "PIONEER_STAR" -> lastPioneerTurn = turn;
                            case "PRECISION_SNIPE" -> lastSniperTurn = turn;
                            case "SCATTER_SHOT" -> lastScatterTurn = turn;
                            default -> { /* unknown boss skill — counts only toward any-cast */ }
                        }
                    }
                } catch (Exception ignored) {
                    // malformed detail — skip (same tolerance as bossTurnOrdinal)
                }
            }
        }
        return new BossAiPolicy.SkillCooldowns(
                distance(currentTurnNumber, lastAnyCastTurn),
                distance(currentTurnNumber, lastPioneerTurn),
                distance(currentTurnNumber, lastSniperTurn),
                distance(currentTurnNumber, lastScatterTurn));
    }

    private static int distance(int currentTurnNumber, int lastCastTurn) {
        return lastCastTurn < 0 ? Integer.MAX_VALUE : currentTurnNumber - lastCastTurn;
    }

    /**
     * §7.6 L1 NOVICE 腳本化教學漏擋 counter: how many prior boss replies this
     * encounter carried the {@code aiFacedOpenThree} audit flag (the boss
     * faced a player open-three formation, whether it blocked or rolled the
     * leniency dice) — persisted via {@link PveEventDetail#aiAudit}, so the
     * teaching script survives replays/reconnects with no schema change.
     */
    private int bossFacedOpenThreeCount(String encounterId) {
        int count = 0;
        for (PveEncounterEvent event : eventRepository
                .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(encounterId, PveEncounterEventType.BOSS_MOVE_PLACED)) {
            if (event.getDetail() == null) {
                continue;
            }
            try {
                PveEventDetail detail = objectMapper.readValue(event.getDetail(), PveEventDetail.class);
                if (Boolean.TRUE.equals(detail.aiFacedOpenThree())) {
                    count++;
                }
            } catch (Exception ignored) {
                // malformed detail — skip
            }
        }
        return count;
    }

    /**
     * §1 全對弈平衡修正（狙擊閉四combo）: whether the player currently holds an
     * unused PRECISION_SNIPE charge (quantity &gt; 0) — the sole extra gate for
     * {@link BossAiPolicy}'s skill-aware defense (TRUE_DEMON/SKILL_DEMON only,
     * i.e. sequence 7/8; NOVICE/APPRENTICE/ELITE never receive this signal, by
     * design decision "L1–L6 不感知"). Once the player spends their one-shot
     * snipe charge, this reverts to false and the boss reverts to its
     * pre-existing (openFour-only) layer-3 behavior — the extra caution is
     * only warranted while the exploit's second half ("狙擊轉色擋子") remains
     * possible.
     */
    private boolean playerHasUnusedSniperCharge(PveRun run) {
        return skillRepository.findByRunIdAndSkillTypeAndDeletedFalse(run.getId(), SkillType.PRECISION_SNIPE)
                .map(sk -> sk.getQuantity() > 0)
                .orElse(false);
    }

    /**
     * Bug fix (task item #2, PveChallengeService:591 in the original report):
     * whether the PLAYER (not the boss) has already cast a skill at the given
     * moveNumber this encounter — a caster-aware replacement for the old
     * {@code eventRepository.existsByEncounterIdAndEventTypeAndMoveNumber(...,
     * SKILL_USED, moveNumber)} check, which counted ANY SKILL_USED event
     * (including L8's caster="BOSS" casts, see {@link #executeBossSkill}) and
     * so let a boss skill cast silently consume the player's own per-interval
     * skill budget. Player casts are persisted via {@code PveEventDetail.skill}
     * (caster=null); boss casts via {@code PveEventDetail.bossSkill}
     * (caster="BOSS") — filtering out "BOSS" is therefore sufficient, no
     * schema change needed (mirrors the existing caster-parsing pattern in
     * {@link #bossSkillCooldowns}/{@link #bossTurnOrdinal}).
     */
    private boolean playerSkillUsedThisInterval(String encounterId, int moveNumber) {
        for (PveEncounterEvent event : eventRepository
                .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(encounterId, PveEncounterEventType.SKILL_USED)) {
            if (!Integer.valueOf(moveNumber).equals(event.getMoveNumber())) {
                continue;
            }
            try {
                PveEventDetail detail = objectMapper.readValue(event.getDetail(), PveEventDetail.class);
                if (!"BOSS".equals(detail.caster())) {
                    return true;
                }
            } catch (Exception ignored) {
                // malformed detail — treat conservatively as a player cast
                // (same fail-closed direction as the original unconditional
                // existence check this replaces).
                return true;
            }
        }
        return false;
    }

    /**
     * L8 "SKILL_DEMON" boss skill cast (§3.1–3.3): mirrors {@link
     * #executeSkill}'s per-skill-type logic for the WHITE-side caster, marks
     * the corresponding one-shot charge as spent (migration V7), and records
     * a caster="BOSS" SKILL_USED event (frontend/replay tell it apart from a
     * player cast of the same skillType) plus a {@code bossSkillEvents} entry
     * for this settlement's response.
     */
    private void executeBossSkill(Settlement s, BossAiPolicy.BossAction.CastSkill cast, PveEncounter encounter) {
        List<PveEventDetail.Cell> placed = new ArrayList<>();
        List<PveEventDetail.Cell> removed = new ArrayList<>();
        switch (cast.skillType()) {
            case PRECISION_SNIPE -> {
                int[] target = cast.targets().get(0);
                s.board.setStone(target[0], target[1], StoneColor.WHITE);
                placed.add(new PveEventDetail.Cell(target[0], target[1], StoneColor.WHITE.name()));
                encounter.setBossSniperUsed(true);
            }
            case SCATTER_SHOT -> {
                for (int[] cell : cast.targets()) {
                    s.board.setStone(cell[0], cell[1], StoneColor.WHITE);
                    placed.add(new PveEventDetail.Cell(cell[0], cell[1], StoneColor.WHITE.name()));
                }
                encounter.setBossScatterUsed(true);
            }
            case PIONEER_STAR -> {
                List<int[]> zone = FieldGeometry.ultimateZone(
                        cast.anchorRow(), cast.anchorCol(), cast.direction(), s.board.size());
                for (int[] cell : zone) {
                    StoneColor color = s.board.stoneAt(cell[0], cell[1]);
                    if (color != null) {
                        s.board.removeStone(cell[0], cell[1]);
                        removed.add(new PveEventDetail.Cell(cell[0], cell[1], color.name()));
                    }
                }
                encounter.setBossPioneerUsed(true);
            }
            default -> throw new IllegalStateException("boss cannot cast " + cast.skillType());
        }
        s.addEvent(PveEncounterEventType.SKILL_USED, null, null,
                PveEventDetail.bossSkill(cast.skillType().name(),
                        placed.isEmpty() ? null : placed,
                        removed.isEmpty() ? null : removed,
                        null));
        List<PveEncounterStateResponse.Cell> affected = (!placed.isEmpty() ? placed : removed).stream()
                .map(c -> new PveEncounterStateResponse.Cell(c.row(), c.col()))
                .toList();
        s.bossSkillEvents.add(new PveEncounterStateResponse.BossSkillEventView(cast.skillType().name(), affected));
    }

    /**
     * The boss-AI RNG seed for a DUEL encounter (§6.5 2026-07-09 公平性修正):
     * {@code run.getSeed()} on an encounter's very first attempt
     * ({@code attemptNumber<=1}, preserving the existing seed+move-number
     * determinism/reproducibility for a fresh encounter, NFR-1), otherwise
     * {@code run.getSeed()} mixed with the retry ordinal — so a DRAWn-and-
     * retried encounter does NOT deterministically replay the exact same
     * boss-AI dice rolls at the same boss-move-number purposes (which would
     * happen if it reused the bare run seed: movesUsed resets to 0 on retry,
     * so bossMoveNumber restarts at 1 too, and the RNG purpose strings are
     * keyed only by runSeed+sequence+bossMoveNumber).
     */
    private String duelRunSeed(PveRun run, PveEncounter encounter) {
        return encounter.getAttemptNumber() <= 1
                ? run.getSeed()
                : run.getSeed() + ":retry" + encounter.getAttemptNumber();
    }

    /**
     * Retries a DRAWn DUEL encounter in place (§1.5/§5.1/§6.5): soft-deletes
     * the old (run_id, sequence) encounter row and creates a fresh one for
     * the SAME sequence via {@link #createEncounter} — the run itself is
     * untouched (still IN_PROGRESS, gold/reach/shop state unaffected) since a
     * DRAW never forfeits the run in the first place. Callable an unlimited
     * number of times; each retry increments {@code attemptNumber} so the
     * boss-AI RNG stream differs from the previous attempt (see
     * {@link #duelRunSeed}) instead of deterministically replaying the exact
     * same draw.
     */
    @Transactional
    public PveEncounterStateResponse retryDuelEncounter(String playerId, String encounterId) {
        PveEncounter encounter = requireEncounter(encounterId);
        PveRun run = requireOwnedRun(playerId, encounter.getRunId());
        if (encounter.getEncounterType() != PveEncounterType.DUEL) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "只有魔王對弈關可以重試");
        }
        if (encounter.getStatus() != PveEncounterStatus.DRAW) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "關卡非和局狀態，無法重試");
        }

        int nextAttempt = encounter.getAttemptNumber() + 1;
        encounter.setDeleted(true);
        // saveAndFlush (not save): Hibernate's flush ordering runs ALL pending
        // INSERTs before ALL pending UPDATEs regardless of call order, so a
        // plain save() here would let createEncounter's INSERT for the fresh
        // row race ahead of this UPDATE — at that instant the OLD row is
        // still is_deleted=false in the database, so the partial unique index
        // uk_pve_encounters_run_sequence (run_id, sequence WHERE is_deleted =
        // false) sees two live rows for the same (run_id, sequence) and the
        // insert 23505s. Flushing the soft-delete first forces it to land
        // before the new row is ever inserted.
        encounterRepository.saveAndFlush(encounter);

        PveEncounter fresh = createEncounter(run, encounter.getSequence());
        fresh.setAttemptNumber(nextAttempt);
        encounterRepository.save(fresh);
        return buildEncounterState(fresh, null, List.of());
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

        // At most 1 PLAYER skill per interval, keyed by completed-move count
        // (FR-B5). Bug fix (documents §2 task list): this must only count the
        // PLAYER'S OWN casts — a L8 SKILL_DEMON boss skill cast (caster="BOSS",
        // see executeBossSkill) is persisted with the SAME moveNumber as the
        // player's just-placed move (Settlement.settleMoveNumber is shared
        // across the whole settlement batch, see persistEvents), so without
        // the caster filter here a boss cast this same interval would wrongly
        // lock out the player's own skill for that interval too, coupling two
        // independent one-per-interval budgets that should never interact.
        if (playerSkillUsedThisInterval(encounter.getId(), encounter.getMovesUsed())) {
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

        if (encounter.getEncounterType() == PveEncounterType.DUEL) {
            // §1.6: skills never trigger a boss reply, even if the cast
            // itself (e.g. PRECISION_SNIPE turning a boss stone black) wins
            // outright — allowBossMove=false covers both cases uniformly.
            return settleDuel(s, playerId, false, null, null);
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
                // §3.1 全對弈階梯設計: caster-color-parameterized — target must be
                // an existing OPPOSING stone (player casts as BLACK, so target
                // must be WHITE: an abyss obstacle stone in a legacy PUZZLE
                // encounter, or a DUEL boss stone).
                StoneColor enemy = StoneColor.BLACK.opposite();
                if (!s.board.inBounds(r, c) || s.board.stoneAt(r, c) != enemy) {
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
                        && c.getCellKind() != FieldCellKind.OBSTACLE
                        && c.getCellKind() != FieldCellKind.INITIAL_BLACK
                        && !c.isTriggered())
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
            int baseBudget = PveFieldScheduler.MOVE_BUDGET_CURVE[s.encounter.getSequence() - 1];
            s.encounter.setMoveBudget(baseBudget + totalRemoved / 10);
        }

        // Abyss: one obstacle stone per resolved line (FR-C6).
        if (s.encounter.getMutationType() == PveMutationType.ABYSS) {
            for (int i = 0; i < resolvable.size(); i++) {
                spawnAbyssObstacle(s);
            }
        }
    }

    /**
     * B5(b) 調校輪2（2026-07-09，強制保底取代機率偏向）：調校輪1（2026-07-08）
     * 曾改成「若近缺格候選池非空則優先選、否則退化全盤均勻隨機」，理論上非空
     * 時已是100%命中，但退化分支（候選池恰好空）在實測中仍會把障礙丟到完全
     * 不相干的位置，兩輪實測「零擋路」——玩家評論指出「狙擊智取查無實據」。
     * 本輪把「退化到全盤均勻」整段拿掉，改成**保底一定盡量貼近**：
     *   1. 先算出所有非backup、尚未完成的雛形，其「還缺的完成格」
     *      （completionCells，且目前仍是空格）——這些格子本身**永遠**從候選池
     *      移除（見下方 protectedGaps），ABYSS絕不會直接生成在玩家真正需要
     *      落子的那一格，這就是「不得直接填缺格造成無解」的可解性保證：無論
     *      生成多少次白子，那個缺格永遠留在empties池外、永遠可落子完成雛形。
     *   2. 只要protectedGaps非空，候選池一律限縮為「距離任一缺格最近」的那個
     *      Chebyshev距離環——{@link #nearestGapPool}會先試距離1，只有在距離1
     *      候選格全被佔滿（極端邊界情況）才擴大到距離2、3……，**沒有「退化回
     *      全盤均勻隨機」這個分支**，故每次生成都保證盡可能貼近某個未完成缺
     *      格（距離1絕大多數情況下就非空，見統計驗證測試 PveMutationRateStatisticsSteps）。
     *      只有本關所有非backup雛形皆已完成（protectedGaps本身為空、ABYSS已
     *      無用武之地）時才回退全盤均勻。
     */
    private void spawnAbyssObstacle(Settlement s) {
        Set<Long> protectedGaps = new LinkedHashSet<>();
        for (PveFieldScheduler.ShapeSpec shape : PveFieldScheduler.activeShapes(s.run.getSeed(), s.encounter.getSequence())) {
            if (shape.backup()) {
                continue;
            }
            for (int[] rc : shape.completionCells()) {
                if (s.board.stoneAt(rc[0], rc[1]) == null) {
                    protectedGaps.add((long) rc[0] * 100 + rc[1]);
                }
            }
        }

        List<int[]> empties = new ArrayList<>();
        for (int r = 0; r < s.board.size(); r++) {
            for (int c = 0; c < s.board.size(); c++) {
                if (!s.board.isEmptyPlayable(r, c) || protectedGaps.contains((long) r * 100 + c)) {
                    continue;
                }
                empties.add(new int[]{r, c});
            }
        }
        if (empties.isEmpty()) {
            return;
        }
        List<int[]> pool = nearestGapPool(empties, protectedGaps);
        int ordinal = s.abyssSpawnOrdinal++ + pastEventCount(s.encounter.getId(), PveEncounterEventType.BOSS_MUTATION_TRIGGERED);
        Random rng = PveRandoms.forPurpose(s.run.getSeed(), "abyss:" + ordinal);
        int[] cell = pool.get(rng.nextInt(pool.size()));
        s.board.setStone(cell[0], cell[1], StoneColor.WHITE);
        s.addEvent(PveEncounterEventType.BOSS_MUTATION_TRIGGERED, cell[0], cell[1],
                PveEventDetail.mutation("ABYSS", null, null));
    }

    /**
     * The subset of {@code empties} at the smallest Chebyshev distance to any
     * cell in {@code gaps} (B5(b) 調校輪2 強制保底 — see spawnAbyssObstacle
     * javadoc). Returns {@code empties} unchanged when {@code gaps} is empty
     * (no incomplete non-backup shape left). Distance 1 is the overwhelmingly
     * common case; the loop only ever widens past it when every distance-1
     * cell around every gap happens to already be occupied.
     */
    private List<int[]> nearestGapPool(List<int[]> empties, Set<Long> gaps) {
        if (gaps.isEmpty()) {
            return empties;
        }
        int bestDistance = Integer.MAX_VALUE;
        int[] distances = new int[empties.size()];
        for (int i = 0; i < empties.size(); i++) {
            int d = minChebyshevDistance(empties.get(i), gaps);
            distances[i] = d;
            if (d < bestDistance) {
                bestDistance = d;
            }
        }
        List<int[]> pool = new ArrayList<>();
        for (int i = 0; i < empties.size(); i++) {
            if (distances[i] == bestDistance) {
                pool.add(empties.get(i));
            }
        }
        return pool;
    }

    private int minChebyshevDistance(int[] cell, Set<Long> gaps) {
        int min = Integer.MAX_VALUE;
        for (long g : gaps) {
            int gr = (int) (g / 100);
            int gc = (int) (g % 100);
            int d = Math.max(Math.abs(cell[0] - gr), Math.abs(cell[1] - gc));
            if (d < min) {
                min = d;
            }
        }
        return min;
    }

    /**
     * B6 盤面感知閘門（2026-07-09 調校輪2放寬）：盤面上是否存在任一方向
     * （橫/縱/雙斜）至少2顆連續黑子。這是「某個5格窗存在未完成、已有進度的
     * 連續段」的level-agnostic通用proxy——2顆連續黑子本身就落在某個5格窗
     * （該2顆+其餘3格）內，且由於resolveLines每手結算後立刻清除任何已完成
     * 的5連線，盤面上任何時刻殘留的連續黑子必然屬於「尚未完成的窗」，不需要
     * 查詢本關實際雛形座標，見resolveRageEruption class doc。
     * 調校輪2（互動命中率）：舊閾值3會被至少1條TYPE_A雛形的prefill
     * （offsets{1,2,3}=3連續）從關卡一開始就恆滿足，但玩家「解序快」時常常在
     * 5手檢查點前就已解完整關（或該次5手檢查點前尚未新增任何連續進度），
     * 造成兩輪實測0次觸發。降到2，配合下方觸發頻率5→3手，讓中段解謎過程更
     * 容易撞上一個真正的檢查點。
     */
    private boolean boardHasProgressedWindow(SeriousBoard board) {
        int[][] dirs = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};
        int size = board.size();
        for (int[] d : dirs) {
            for (int r = 0; r < size; r++) {
                for (int c = 0; c < size; c++) {
                    int run = 0;
                    int rr = r;
                    int cc = c;
                    while (rr >= 0 && rr < size && cc >= 0 && cc < size && board.stoneAt(rr, cc) == StoneColor.BLACK) {
                        run++;
                        if (run >= 2) {
                            return true;
                        }
                        rr += d[0];
                        cc += d[1];
                    }
                }
            }
        }
        return false;
    }

    /**
     * Rage: erupt a random occupied cell, clearing it + 8 neighbors (FR-C6).
     *
     * B6 公平性調校（2026-07-08，2026-07-09 調校輪2再調）：舊行為是「固定每5手
     * 觸發」，跟盤面完成度無關，玩家評價這是「僥倖」而非「張力」。改為「盤面
     * 感知」：
     *  1. 觸發頻率——每3手檢查一次（調校輪2：原5手，玩家「解序快」常在檢查點
     *     前就已解完整關或尚無新進度，兩輪實測0次觸發；縮短間隔提高撞上檢查點
     *     的機率）。觸發閘門——只有當盤面上存在某個5格窗格內「至少2顆連續黑子」
     *     （調校輪2：原3顆，同樣為了放寬命中率）時才觸發；否則本次3手節點直接
     *     跳過（安全的no-op，不消耗任何機會，下一個3手節點再檢查一次)。這避免
     *     在盤面幾乎清空、雙方都還沒有實質進度時做出無意義的懲罰。閘門用「盤面
     *     上是否存在任一方向的2顆以上連續黑子」這個level-agnostic的通用判斷
     *     （見{@link #boardHasProgressedWindow}），不依賴本關實際雛形座標——
     *     因為每關至少1條TYPE_A雛形從encounter建立起就恰好是3連續黑子（遠高於
     *     新閾值2），本判斷在真實對局中恆為true，同時也讓PveMutationSteps
     *     「blank-board premise」的手工測資（clearInitialShapeStones後自行擺放
     *     的十字形棋子，完成後本身就含2條3連續）能自然滿足閘門，不需要額外的
     *     測試專用旁路。
     *  2. 炸點避開「唯一解窗」——若目前只剩最後一條「有部分進度」的雛形窗
     *     （0&lt;filled&lt;5；其餘窗或已結算消線、或全空——調校輪2修正，見迴圈內
     *     註解），本次爆炸的中心與波及的8鄰格一律跳過該窗的5個格子，保證這條
     *     僅存的解仍然可完成；若還有≥2條雛形帶著部分進度，才允許炸到任一條的
     *     已放棋子（此時破壞—重建的張力來自「還有別條線可退可補」，不會導致
     *     無解）。這與現有pulseClear/pulsePush的「protectedCells」手法一致。
     *     （手工測資因會清空所有本關雛形，此段對其而言恆為no-op：每個雛形窗
     *     全空讀作「非pending」，pendingWindows為空，故protectedCells為空，
     *     不影響手工測資自訂的棋子座標。）
     */
    private void resolveRageEruption(Settlement s, int runMoveNumber) {
        if (!boardHasProgressedWindow(s.board)) {
            return; // 盤面感知閘門：盤面上沒有任何2連續以上的黑子，本次觸發跳過
        }
        List<PveFieldScheduler.ShapeSpec> shapes = PveFieldScheduler.activeShapes(s.run.getSeed(), s.encounter.getSequence());
        List<Set<Long>> pendingWindows = new ArrayList<>();
        for (PveFieldScheduler.ShapeSpec shape : shapes) {
            if (shape.backup()) {
                continue;
            }
            List<int[]> window = shape.windowCells();
            long filled = window.stream().filter(rc -> s.board.stoneAt(rc[0], rc[1]) == StoneColor.BLACK).count();
            // 調校輪2 (2026-07-09) 修正: 原判斷 `filled < 5` 會把「已結算消線」的窗
            // （消線後0/5全空）也算成pending，导致pendingWindows幾乎永遠>1、下方
            // 唯一解窗保護形同虛設（與本方法javadoc「其餘皆已結算消線」的設計意圖
            // 相悖）。改為只計「有部分進度的窗」（0<filled<5）：全空窗沒有任何棋子
            // 可被炸（爆炸只清棋、不佔格），本來就不需要保護；已結算窗自然被排除。
            // 統計驗證：兩個template各30000次蒙地卡羅，修正後budget=14內0失敗。
            if (filled > 0 && filled < window.size()) {
                Set<Long> cells = new LinkedHashSet<>();
                for (int[] rc : window) {
                    cells.add((long) rc[0] * 100 + rc[1]);
                }
                pendingWindows.add(cells);
            }
        }
        Set<Long> protectedCells = pendingWindows.size() == 1 ? pendingWindows.get(0) : Set.of();

        List<int[]> occupied = new ArrayList<>();
        for (int r = 0; r < s.board.size(); r++) {
            for (int c = 0; c < s.board.size(); c++) {
                if (s.board.hasStone(r, c) && !protectedCells.contains((long) r * 100 + c)) {
                    occupied.add(new int[]{r, c});
                }
            }
        }
        if (occupied.isEmpty()) {
            return; // 唯一解窗保護後已無其他可炸目標——安全no-op
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
            if (protectedCells.contains((long) cell[0] * 100 + cell[1])) {
                continue; // B6: the blast radius must never touch the sole remaining window
            }
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

    /**
     * Single-shot minor disruption (documents/PVE-關卡重設計-2026-07-08.md §5):
     * fires once at the halfway point of the move budget, on non-mutation
     * sequences 1/2/4/5/7 only. Never touches a cell inside any active
     * shape's 5-cell window — that guarantee is what keeps every level's
     * designed solution always completable regardless of this draw (the
     * design doc does not itself reason about interaction with the very
     * tight early-level budgets, so this scoping is a deliberate,
     * solvability-preserving implementation choice).
     */
    private void resolveMinorDisruption(Settlement s, int encounterMoveNumber) {
        PveEncounter encounter = s.encounter;
        if (encounter.isMinorDisruptionTriggered()
                || encounter.getMinorDisruptionType() == PveMinorDisruptionType.NONE) {
            return;
        }
        int halfway = Math.max(1, encounter.getMoveBudget() / 2);
        if (encounterMoveNumber != halfway) {
            return;
        }
        encounter.setMinorDisruptionTriggered(true);
        Set<Long> protectedCells = shapeWindowCells(s.run.getSeed(), encounter.getSequence());
        if (encounter.getMinorDisruptionType() == PveMinorDisruptionType.PULSE_CLEAR) {
            pulseClear(s, protectedCells);
        } else {
            pulsePush(s, protectedCells);
        }
    }

    private Set<Long> shapeWindowCells(String seed, int sequence) {
        Set<Long> cells = new LinkedHashSet<>();
        for (PveFieldScheduler.ShapeSpec shape : PveFieldScheduler.activeShapes(seed, sequence)) {
            for (int[] rc : shape.windowCells()) {
                cells.add((long) rc[0] * 100 + rc[1]);
            }
        }
        return cells;
    }

    /** Mirrors resolveRageEruption's clear (no boss damage, Volcano Heart exception) but never on protected cells. */
    private void pulseClear(Settlement s, Set<Long> protectedCells) {
        List<int[]> candidates = new ArrayList<>();
        for (int r = 0; r < s.board.size(); r++) {
            for (int c = 0; c < s.board.size(); c++) {
                if (s.board.hasStone(r, c) && !protectedCells.contains((long) r * 100 + c)) {
                    candidates.add(new int[]{r, c});
                }
            }
        }
        if (candidates.isEmpty()) {
            return; // nothing eligible to clear — a safe no-op
        }
        candidates.sort(Comparator.comparingInt((int[] p) -> p[0] * 100 + p[1]));
        Random rng = PveRandoms.forPurpose(s.run.getSeed(), "disruption-fire:" + s.encounter.getSequence());
        int[] center = candidates.get(rng.nextInt(candidates.size()));

        List<PveEventDetail.Cell> cleared = new ArrayList<>();
        int playerStonesCleared = 0;
        List<int[]> zone = new ArrayList<>();
        zone.add(center);
        zone.addAll(eightNeighbors(center[0], center[1], s.board.size()));
        for (int[] cell : zone) {
            if (protectedCells.contains((long) cell[0] * 100 + cell[1])) {
                continue;
            }
            StoneColor color = s.board.stoneAt(cell[0], cell[1]);
            if (color != null) {
                s.board.removeStone(cell[0], cell[1]);
                cleared.add(new PveEventDetail.Cell(cell[0], cell[1], color.name()));
                if (color == StoneColor.BLACK) {
                    playerStonesCleared++;
                }
            }
        }
        Integer heartDamage = null;
        if (s.hasRelic(PveRelicType.VOLCANO_HEART)) {
            heartDamage = playerStonesCleared * 10;
            s.extraDamage += heartDamage;
        }
        s.addEvent(PveEncounterEventType.BOSS_MUTATION_TRIGGERED, center[0], center[1],
                PveEventDetail.mutation("PULSE_CLEAR", cleared, heartDamage));
    }

    /** Mirrors a WAVE-style push: one occupied row (entirely free of protected cells) slides one step. */
    private void pulsePush(Settlement s, Set<Long> protectedCells) {
        List<Integer> candidateRows = new ArrayList<>();
        for (int r = 0; r < s.board.size(); r++) {
            boolean rowHasProtected = false;
            boolean rowHasStone = false;
            for (int c = 0; c < s.board.size(); c++) {
                if (protectedCells.contains((long) r * 100 + c)) {
                    rowHasProtected = true;
                }
                if (s.board.hasStone(r, c)) {
                    rowHasStone = true;
                }
            }
            if (!rowHasProtected && rowHasStone) {
                candidateRows.add(r);
            }
        }
        if (candidateRows.isEmpty()) {
            return; // nothing eligible to push — a safe no-op
        }
        Random rng = PveRandoms.forPurpose(s.run.getSeed(), "disruption-fire:" + s.encounter.getSequence());
        int row = candidateRows.get(rng.nextInt(candidateRows.size()));
        SkillDirection dir = rng.nextBoolean() ? SkillDirection.RIGHT : SkillDirection.LEFT;
        List<int[]> sources = new ArrayList<>();
        for (int c = 0; c < s.board.size(); c++) {
            if (s.board.hasStone(row, c)) {
                sources.add(new int[]{row, c});
            }
        }
        recordPushOutcome(s, PushResolver.push(s.board, sources, dir));
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

    /**
     * Clear: award gold, advance reach, open shop or settle the run (FR-C3
     * FR-C4 FR-C7). Public (like {@link #createEncounter}) so test harnesses
     * can force-clear an encounter directly through the real economy/shop/
     * run-settlement side effects without re-deriving them — callers must
     * persist {@code run}/{@code encounter} afterward themselves (this method
     * only mutates in-memory state, matching finishSettlement's own contract).
     */
    public void onEncounterCleared(PveRun run, PveEncounter encounter) {
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
        encounter.setMinorDisruptionType(plan.minorDisruptionType());
        encounter.setEncounterType(plan.encounterType());
        encounter.setOpeningScript(plan.openingScript());
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

        // 舊「第6關（RAGE）保底橫劈×1」區塊已移除（bug fix, task item #3）：
        // 該邏輯的整個前提（RAGE 突變炸散己方棋子、橫劈把它們推回原位）隨消線
        // 模式全面退役（documents/PVE-全對弈階梯設計-2026-07-10.md §8 拆除清單：
        // ONE_EYE/RAGE/ABYSS 突變退役）——新版第6關是 ELITE+WAVE（推浪場地，
        // 與 RAGE 無關），這個補償的存在理由已不成立，且沒有任何現行 spec/
        // feature 斷言依賴它，故直接移除而非改寫。

        // L4 保底技能（2026-07-09 見習魔王調校 §6.4，沿用進 2026-07-10 全對弈
        // 階梯設計 §5.2「這個寫法可以直接沿用...不需要重新設計」）：第4關開局
        // 保證玩家持有至少2個橫劈(HORIZONTAL_SLASH)——「推子智取魔王棋子」的
        // 體感設計，只對 WARRIOR 有意義。
        //
        // bug fix（task item #3，"弓箭手保底贈橫劈×2殘留"）：這裡原本沒有職業
        // 判斷，任何職業（含 ARCHER，起始技能是精準狙擊、商職技能組完全不含
        // 橫劈）進到第4關都會被無條件塞一個跟自己班職毫無關聯的 WARRIOR 技能。
        // 加上 WARRIOR-only 判斷後改為「職業對應」：ARCHER 玩家不再收到這個
        // 離題的贈送（維持 specs/features/pve/魔王對弈.feature「第4關進場保底
        // 補足橫劈技能至2個」場景不變——該場景的預設職業是 WARRIOR，見
        // PveCommonSteps#pveRunInProgressFor）。
        if (sequence == 4 && run.getClassType() == ClassType.WARRIOR) {
            PveRunSkill horizontalSlash = skillRepository
                    .findByRunIdAndSkillTypeAndDeletedFalse(run.getId(), SkillType.HORIZONTAL_SLASH)
                    .orElseGet(() -> {
                        PveRunSkill sk = new PveRunSkill();
                        sk.setRunId(run.getId());
                        sk.setSkillType(SkillType.HORIZONTAL_SLASH);
                        sk.setQuantity(0);
                        return sk;
                    });
            if (horizontalSlash.getQuantity() < 2) {
                horizontalSlash.setQuantity(2);
                skillRepository.save(horizontalSlash);
            }
        }
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
        return buildEncounterState(encounter, resolution, eventViews, List.of());
    }

    PveEncounterStateResponse buildEncounterState(PveEncounter encounter,
                                                  PveEncounterStateResponse.Resolution resolution,
                                                  List<PveEncounterStateResponse.EventView> eventViews,
                                                  List<PveEncounterStateResponse.BossSkillEventView> bossSkillEvents) {
        List<PveFieldCell> fieldCells = fieldCellRepository.findByEncounterIdAndDeletedFalse(encounter.getId());
        List<PveEncounterMove> moves = moveRepository.findByEncounterIdOrderByEncounterMoveNumberAsc(encounter.getId());
        List<PveEncounterEvent> events = eventRepository.findByEncounterIdOrderByOccurredAtAscIdAsc(encounter.getId());
        SeriousBoard board = PveBoardReplayer.rebuild(fieldCells, moves, events, objectMapper);

        boolean duel = encounter.getEncounterType() == PveEncounterType.DUEL;
        List<PveEncounterStateResponse.Cell> stones = new ArrayList<>();
        List<PveEncounterStateResponse.ObstacleCell> obstacles = new ArrayList<>();
        for (int r = 0; r < board.size(); r++) {
            for (int c = 0; c < board.size(); c++) {
                if (board.stoneAt(r, c) == StoneColor.BLACK) {
                    stones.add(new PveEncounterStateResponse.Cell(r, c));
                } else if (board.stoneAt(r, c) == StoneColor.WHITE) {
                    obstacles.add(new PveEncounterStateResponse.ObstacleCell(r, c, duel ? "ENEMY_STONE" : "ROCK"));
                } else if (board.isObstacle(r, c)) {
                    obstacles.add(new PveEncounterStateResponse.ObstacleCell(r, c, "ROCK"));
                }
            }
        }

        // Bug fix (task item #2): must only reflect the PLAYER'S own per-
        // interval skill budget — see playerSkillUsedThisInterval's javadoc
        // for why the old unconditional existsBy... check wrongly let a L8
        // boss skill cast (same moveNumber, different caster) lock the
        // player out.
        boolean skillUsable = encounter.getStatus() == PveEncounterStatus.IN_PROGRESS
                && !playerSkillUsedThisInterval(encounter.getId(), encounter.getMovesUsed());

        // Bug fix (task item #5): usedSkills used to mix the player's own
        // casts with the L8 boss's caster="BOSS" casts into one undifferentiated
        // list, so the frontend's "本關已使用技能" list silently included the
        // boss's PRECISION_SNIPE/SCATTER_SHOT/PIONEER_STAR uses with no
        // indication they weren't the player's own — split by caster instead;
        // bossUsedSkills is additive so existing consumers of usedSkills keep
        // seeing player-only casts (arguably the correct fix on its own,
        // per §9.1's "caster-parameterized" precedent) with the boss's history
        // now available under its own label for the frontend to render with a
        // "魔王" tag.
        List<String> usedSkills = new ArrayList<>();
        List<String> bossUsedSkills = new ArrayList<>();
        for (PveEncounterEvent e : events) {
            if (e.getEventType() != PveEncounterEventType.SKILL_USED) {
                continue;
            }
            try {
                PveEventDetail detail = objectMapper.readValue(e.getDetail(), PveEventDetail.class);
                if (detail.skillType() == null) {
                    continue;
                }
                if ("BOSS".equals(detail.caster())) {
                    bossUsedSkills.add(detail.skillType());
                } else {
                    usedSkills.add(detail.skillType());
                }
            } catch (Exception ignored) {
                // malformed detail — skip (same tolerance as elsewhere)
            }
        }

        return new PveEncounterStateResponse(
                encounter.getId(),
                encounter.getRunId(),
                encounter.getSequence(),
                encounter.getFieldType().name(),
                encounter.getMutationType().name(),
                encounter.getEncounterType().name(),
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
                usedSkills,
                encounter.getSequence() == 3,
                bossSkillEvents == null ? List.of() : bossSkillEvents,
                bossUsedSkills);
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
        final List<PveEncounterStateResponse.BossSkillEventView> bossSkillEvents = new ArrayList<>();
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
