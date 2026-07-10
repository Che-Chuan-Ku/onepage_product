package com.gomoku.steps.pve;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveEncounterMove;
import com.gomoku.domain.entity.PveFieldCell;
import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.entity.PveRunRelic;
import com.gomoku.domain.entity.PveRunSkill;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.PveEncounterEventType;
import com.gomoku.domain.enums.PveEncounterStatus;
import com.gomoku.domain.enums.PveEncounterType;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.game.DuelPlayerPolicy;
import com.gomoku.game.PveBoardReplayer;
import com.gomoku.game.PveFieldScheduler;
import com.gomoku.game.ReferencePlayerPolicy;
import com.gomoku.game.SeriousBoard;
import com.gomoku.repository.PveEncounterEventRepository;
import com.gomoku.repository.PveEncounterMoveRepository;
import com.gomoku.repository.PveEncounterRepository;
import com.gomoku.repository.PveFieldCellRepository;
import com.gomoku.repository.PveFieldStateRepository;
import com.gomoku.repository.PveRunRelicRepository;
import com.gomoku.repository.PveRunRepository;
import com.gomoku.repository.PveRunSkillRepository;
import com.gomoku.repository.PveShopVisitRepository;
import com.gomoku.service.PveChallengeService;
import com.gomoku.steps.common_given.CommonGiven;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Shared PVE glue: run creation backgrounds, HTTP helpers, board helpers
 * (clean-line play, filler placement), repo seams for Given arrangements, and
 * Then steps shared across several PVE features.
 *
 * Memo keys: pve:user, pve:runId, pve:encounterId, pve:lastState (data map of
 * the latest 2xx settle/read), plus scenario-local keys set by feature steps.
 */
public class PveCommonSteps {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private ScenarioContext ctx;
    @Autowired private CommonGiven commonGiven;
    @Autowired private PveRunRepository runRepository;
    @Autowired private PveEncounterRepository encounterRepository;
    @Autowired private PveEncounterMoveRepository moveRepository;
    @Autowired private PveEncounterEventRepository eventRepository;
    @Autowired private PveFieldCellRepository fieldCellRepository;
    @Autowired private PveFieldStateRepository fieldStateRepository;
    @Autowired private PveRunSkillRepository skillRepository;
    @Autowired private PveRunRelicRepository relicRepository;
    @Autowired private PveShopVisitRepository shopVisitRepository;
    @Autowired private PveChallengeService challengeService;
    @Autowired private ObjectMapper objectMapper;

    // ────────────────────────── backgrounds ──────────────────────────────────

    @Given("^一場PVE挑戰對局進行中，棋盤11×11，倍率為 1\\.0$")
    public void pveGameInProgressWithBoard() {
        startRun("alice", "WARRIOR");
        // 連線傷害結算.feature builds ad-hoc unrelated line/cross constructions
        // (5-9 moves) — bump the budget (level 1's real budget is now 3; see
        // setMoveBudget javadoc) AND clear level 1's own pre-placed TYPE_A
        // shape (its col4 stones can otherwise silently extend an ad-hoc
        // horizontal line into an accidental premature clear, ~50% of runs
        // depending on the seed-driven Template A/B pick — see
        // clearInitialShapeStones javadoc). This background is exclusive to
        // that feature.
        setMoveBudget(100);
        clearInitialShapeStones();
    }

    @Given("一場PVE挑戰對局進行中，第1關 BossHP 100，手數預算30")
    public void pveGameInProgressFirstEncounter() {
        startRun("alice", "WARRIOR");
        // 關卡勝敗判定.feature's background text states an illustrative
        // moveBudget=30 (decoupled from level 1's real curve value, now 3 —
        // see Run循環與場地排程.feature's note); it also plays an ad-hoc clean
        // line via playCleanVerticalLine, so also clear level 1's own
        // pre-placed shape (see clearInitialShapeStones javadoc).
        setMoveBudget(30);
        clearInitialShapeStones();
    }

    @Given("一場PVE挑戰對局進行中，玩家 {string} 職業為 {string}")
    public void pveGameInProgressWithClass(String user, String classType) {
        startRun(user, classType);
        // 技能使用.feature (the only feature using this background) builds
        // ad-hoc stone constructions at hand-picked coordinates unrelated to
        // level 1's own designed puzzle (e.g. PIONEER_STAR's (4,6)/(5,6)) —
        // clear level 1's pre-placed TYPE_A shape so it can't collide (§5 D4
        // board transform, 2026-07-08: the shape's column/rows are no longer
        // pinned to column 4, they can land anywhere post-transform, so a
        // "safe" hardcoded coordinate before the transform existed is no
        // longer guaranteed safe — see clearInitialShapeStones javadoc).
        clearInitialShapeStones();
    }

    @Given("一個PVE Run進行中")
    public void pveRunInProgress() {
        startRun("alice", "WARRIOR");
    }

    @Given("玩家 {string} 職業為 {string}，一個PVE Run進行中")
    public void pveRunInProgressWithClass(String user, String classType) {
        startRun(user, classType);
    }

    @Given("玩家 {string} 一個PVE Run進行中")
    public void pveRunInProgressFor(String user) {
        startRun(user, "WARRIOR");
    }

    @Given("玩家 {string} 一個PVE Run進行中，classType為 {string}")
    public void pveRunInProgressForWithClass(String user, String classType) {
        startRun(user, classType);
    }

    // ────────────────────────── shared Then steps ────────────────────────────

    @Then("^系統結算傷害 (\\d+)（.*）$")
    public void systemSettlesDamage(int expected) {
        Map<String, Object> resolution = lastResolution();
        Assertions.assertThat(resolution).as("lastResolution must be present").isNotNull();
        Assertions.assertThat(((Number) resolution.get("damageDealt")).intValue()).isEqualTo(expected);
    }

    @Then("^系統結算基礎分 (\\d+)（.*）$")
    public void systemSettlesBaseScore(int expected) {
        List<Map<String, Object>> lines = resolvedLines();
        Assertions.assertThat(lines).isNotEmpty();
        Assertions.assertThat(((Number) lines.get(0).get("baseScore")).intValue()).isEqualTo(expected);
    }

    @Then("系統發布 LineResolved 事件")
    public void lineResolvedPublished() {
        Assertions.assertThat(eventRepository
                        .findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                                encounterId(), PveEncounterEventType.LINE_RESOLVED))
                .isNotEmpty();
    }

    @Then("Run狀態變為 {string}")
    public void runStatusBecomes(String expected) {
        Assertions.assertThat(run().getStatus().name()).isEqualTo(expected);
    }

    // ────────────────────────── run / HTTP helpers ───────────────────────────

    public void startRun(String user, String classType) {
        commonGiven.playerIsLoggedIn(user);
        ctx.putMemo("pve:user", user);
        createRunApi(user, classType, null);
        Assertions.assertThat(ctx.getMemo("pve:runId")).as("run must be created").isNotNull();
    }

    @SuppressWarnings("unchecked")
    public ResponseEntity<Map> createRunApi(String user, String classType, String seed) {
        String body = seed == null
                ? String.format("{\"classType\":\"%s\"}", classType)
                : String.format("{\"classType\":\"%s\",\"seed\":\"%s\"}", classType, seed);
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "/api/gmk/v1/pve/runs",
                new HttpEntity<>(body, commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
            Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
            ctx.putMemo("pve:runId", data.get("runId"));
            Map<String, Object> encounter = (Map<String, Object>) data.get("currentEncounter");
            if (encounter != null) {
                ctx.putMemo("pve:encounterId", encounter.get("encounterId"));
            }
        }
        return resp;
    }

    @SuppressWarnings("unchecked")
    public ResponseEntity<Map> placeMoveApi(String user, int row, int col) {
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "/api/gmk/v1/pve/encounters/" + encounterId() + "/moves",
                new HttpEntity<>(String.format("{\"row\":%d,\"col\":%d}", row, col),
                        commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
            ctx.putMemo("pve:lastState", resp.getBody().get("data"));
        }
        return resp;
    }

    @SuppressWarnings("unchecked")
    public ResponseEntity<Map> useSkillApi(String user, String bodyJson) {
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "/api/gmk/v1/pve/encounters/" + encounterId() + "/actions/use-skill",
                new HttpEntity<>(bodyJson, commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
            ctx.putMemo("pve:lastState", resp.getBody().get("data"));
        }
        return resp;
    }

    /**
     * POST /pve/encounters/{encounterId}/actions/retry (2026-07-09 §1.5/§6.5
     * 公平性修正) — DUEL-only, DRAW-status-only: reopens the same sequence
     * with a fresh board. On success, updates {@code pve:encounterId} to the
     * NEW encounter's id (the old one is soft-deleted server-side) and
     * {@code pve:lastState} to its state, mirroring placeMoveApi/useSkillApi.
     */
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map> retryEncounterApi(String user) {
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "/api/gmk/v1/pve/encounters/" + encounterId() + "/actions/retry",
                new HttpEntity<>("{}", commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
            Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
            ctx.putMemo("pve:lastState", data);
            ctx.putMemo("pve:encounterId", data.get("encounterId"));
        }
        return resp;
    }

    /** Default-parameter cast used by steps that name only the skill. */
    public ResponseEntity<Map> useSkillDefault(String user, String skillType) {
        String body = switch (skillType) {
            case "HORIZONTAL_SLASH" ->
                    "{\"skillType\":\"HORIZONTAL_SLASH\",\"direction\":\"UP\",\"anchor\":{\"row\":5,\"col\":5}}";
            case "VERTICAL_SLASH" ->
                    "{\"skillType\":\"VERTICAL_SLASH\",\"direction\":\"RIGHT\",\"anchor\":{\"row\":5,\"col\":5}}";
            case "HEAVEN_EARTH_REVERSAL", "PIONEER_STAR" -> String.format(
                    "{\"skillType\":\"%s\",\"direction\":\"RIGHT\",\"anchor\":{\"row\":5,\"col\":5}}", skillType);
            case "SCATTER_SHOT" ->
                    "{\"skillType\":\"SCATTER_SHOT\",\"anchor\":{\"row\":0,\"col\":0},\"secondStone\":{\"row\":0,\"col\":10}}";
            default -> String.format(
                    "{\"skillType\":\"%s\",\"target\":{\"row\":5,\"col\":5}}", skillType);
        };
        return useSkillApi(user, body);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getEncounterApi(String user) {
        ResponseEntity<Map> resp = restTemplate.exchange(
                "/api/gmk/v1/pve/encounters/" + encounterId(),
                org.springframework.http.HttpMethod.GET,
                new HttpEntity<>(commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        return resp.getBody() == null ? null : (Map<String, Object>) resp.getBody().get("data");
    }

    /** Like {@link #getEncounterApi(String)} but for an explicit id (not the memoized "current" one) — used to assert a retired/soft-deleted encounter 404s. */
    public ResponseEntity<Map> getEncounterByIdApi(String user, String encId) {
        ResponseEntity<Map> resp = restTemplate.exchange(
                "/api/gmk/v1/pve/encounters/" + encId,
                org.springframework.http.HttpMethod.GET,
                new HttpEntity<>(commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        return resp;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getCurrentRunApi(String user) {
        ResponseEntity<Map> resp = restTemplate.exchange(
                "/api/gmk/v1/pve/runs/current",
                org.springframework.http.HttpMethod.GET,
                new HttpEntity<>(commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        return resp.getBody() == null ? null : (Map<String, Object>) resp.getBody().get("data");
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getRunResultApi(String user) {
        ResponseEntity<Map> resp = restTemplate.exchange(
                "/api/gmk/v1/pve/runs/" + runId() + "/result",
                org.springframework.http.HttpMethod.GET,
                new HttpEntity<>(commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        return resp.getBody() == null ? null : (Map<String, Object>) resp.getBody().get("data");
    }

    @SuppressWarnings("unchecked")
    public ResponseEntity<Map> skipShopApi(String user) {
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "/api/gmk/v1/pve/runs/" + runId() + "/shop/actions/skip",
                new HttpEntity<>("{}", commonGiven.authHeaders(user)),
                Map.class);
        ctx.setLastResponse(resp);
        if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
            Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
            if (data != null && data.get("encounterId") != null) {
                ctx.putMemo("pve:encounterId", data.get("encounterId"));
                ctx.putMemo("pve:lastState", data);
            }
        }
        return resp;
    }

    // ────────────────────────── board play helpers ───────────────────────────

    /** Occupied/blocked cells: stones + obstacles from the API + hidden cells from the repo. */
    public Set<Long> blockedCells(String user) {
        Map<String, Object> state = getEncounterApi(user);
        Set<Long> blocked = new HashSet<>();
        addCells(blocked, state, "stones");
        addCells(blocked, state, "obstacles");
        for (PveFieldCell cell : fieldCellRepository.findByEncounterIdAndDeletedFalse(encounterId())) {
            if (cell.getCellKind() != FieldCellKind.OBSTACLE && !cell.isTriggered()) {
                blocked.add(key(cell.getRow(), cell.getCol()));
            }
        }
        return blocked;
    }

    @SuppressWarnings("unchecked")
    private void addCells(Set<Long> into, Map<String, Object> state, String field) {
        if (state == null) {
            return;
        }
        List<Map<String, Object>> cells = (List<Map<String, Object>>) state.get(field);
        if (cells == null) {
            return;
        }
        for (Map<String, Object> cell : cells) {
            into.add(key(((Number) cell.get("row")).intValue(), ((Number) cell.get("col")).intValue()));
        }
    }

    public static long key(int row, int col) {
        return (long) row * 100 + col;
    }

    /**
     * Play a clean vertical 5-line (never horizontal — ONE_EYE-safe): pick a
     * column segment whose 3-column neighbourhood is stone-free and place the
     * 5 stones bottom-up; the 5th settles the line.
     */
    public void playCleanVerticalLine(String user) {
        Set<Long> blocked = blockedCells(user);
        int[] segment = findVerticalSegment(blocked);
        Assertions.assertThat(segment).as("a clean vertical 5-segment must exist").isNotNull();
        int col = segment[1];
        for (int r = segment[0]; r < segment[0] + 5; r++) {
            ResponseEntity<Map> resp = placeMoveApi(user, r, col);
            Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                    .as("clean-line move (%d,%d) must succeed: %s", r, col, resp.getBody())
                    .isTrue();
        }
    }

    /**
     * Only the target column's own 5-cell window + a 1-row vertical buffer
     * above/below must be clear (prevents the line silently becoming a 6+
     * run) — a full 3-column neighborhood is no longer required now that PVE
     * boards start with dense pre-placed shapes (documents/PVE-關卡重設計-
     * 2026-07-08.md §0/§2: every level's shapes sit exclusively on even
     * columns 0/2/4/6/8/10, so any odd column is always entirely free of
     * them). Residual risk of an incidental diagonal merge is accepted —
     * extremely low given the design's >=2 column-spacing safety lemma.
     */
    private int[] findVerticalSegment(Set<Long> blocked) {
        for (int col = 0; col < 11; col++) {
            for (int startRow = 0; startRow + 4 < 11; startRow++) {
                boolean ok = true;
                for (int r = Math.max(0, startRow - 1); r <= Math.min(10, startRow + 5) && ok; r++) {
                    if (blocked.contains(key(r, col))) {
                        ok = false;
                    }
                }
                if (ok) {
                    return new int[]{startRow, col};
                }
            }
        }
        return null;
    }

    /** Scattered non-line filler placements; re-queries occupancy per move. */
    public void placeFillers(String user, int count) {
        List<int[]> pool = fillerPool();
        int placed = 0;
        while (placed < count) {
            Set<Long> blocked = blockedCells(user);
            int[] cell = pool.stream()
                    .filter(p -> !blocked.contains(key(p[0], p[1])))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("no free filler cell left"));
            ResponseEntity<Map> resp = placeMoveApi(user, cell[0], cell[1]);
            Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                    .as("filler move (%d,%d) must succeed: %s", cell[0], cell[1], resp.getBody())
                    .isTrue();
            pool.remove(cell);
            placed++;
        }
    }

    private List<int[]> fillerPool() {
        List<int[]> pool = new ArrayList<>();
        for (int r = 10; r >= 7; r--) {
            for (int c = (r % 2 == 0) ? 0 : 1; c < 11; c += 2) {
                pool.add(new int[]{r, c});
            }
        }
        return pool;
    }

    // ────────────────────────── repo seams ───────────────────────────────────

    public PveRun run() {
        return runRepository.findById(runId()).orElseThrow();
    }

    public PveEncounter encounter() {
        return encounterRepository.findById(encounterId()).orElseThrow();
    }

    public String runId() {
        return String.valueOf(ctx.getMemo("pve:runId"));
    }

    public String encounterId() {
        return String.valueOf(ctx.getMemo("pve:encounterId"));
    }

    public String user() {
        Object user = ctx.getMemo("pve:user");
        return user == null ? "alice" : user.toString();
    }

    public void setBossHp(int hp) {
        PveEncounter encounter = encounter();
        encounter.setBossHpCurrent(hp);
        encounterRepository.save(encounter);
    }

    /**
     * Overrides the current encounter's move budget — an explicit escape
     * hatch for relic/effect unit-style tests that build an ad-hoc board
     * unrelated to the level's own designed solution (documents/PVE-關卡
     * 重設計-2026-07-08.md shrank every real per-level budget to just
     * 30-60% slack over its own solution, too tight for such constructions).
     */
    public void setMoveBudget(int budget) {
        PveEncounter encounter = encounter();
        encounter.setMoveBudget(budget);
        encounterRepository.save(encounter);
    }

    /**
     * Removes the current encounter's pre-placed INITIAL_BLACK shape cells
     * (documents/PVE-關卡重設計-2026-07-08.md §0/§6) AND disarms its single-shot
     * minor disruption (§5), restoring the blank-board premise some
     * narrowly-scoped mechanism unit tests need: RAGE's "pick a random
     * occupied cell" changes which cell an unrelated ad-hoc stone cluster's
     * index maps to if the template is present, and — separately — sequences
     * 1/2/4/5/7's minor disruption fires at moveBudget/2 (move 1 for level 1's
     * real budget=3), which would otherwise silently clear/push an ad-hoc
     * test's own just-placed stone before its later assertions run.
     * Interaction between RAGE/ABYSS/minor-disruption and the real template
     * is covered separately by completeCurrentEncounterShapes / the 關卡可解性
     * harness — this method is only for tests that want a truly blank board.
     */
    public void clearInitialShapeStones() {
        for (PveFieldCell cell : fieldCellRepository.findByEncounterIdAndDeletedFalse(encounterId())) {
            if (cell.getCellKind() == FieldCellKind.INITIAL_BLACK) {
                cell.setDeleted(true);
                fieldCellRepository.save(cell);
            }
        }
        disableMinorDisruption();
    }

    /**
     * Disarms the current encounter's single-shot minor disruption (§5)
     * without touching its pre-placed shape cells — for tests that DO want
     * the real template (e.g. completing it via completeCurrentEncounterShapes)
     * but still need determinism: on tight-budget levels (level 1's real
     * budget is 3) the disruption fires as early as move 1, which could
     * otherwise clear/push a stone mid-solve before a strict assertion runs.
     */
    public void disableMinorDisruption() {
        PveEncounter encounter = encounter();
        encounter.setMinorDisruptionType(com.gomoku.domain.enums.PveMinorDisruptionType.NONE);
        encounter.setMinorDisruptionTriggered(true);
        encounterRepository.save(encounter);
    }

    public void grantSkill(SkillType type, int quantity) {
        PveRunSkill skill = skillRepository
                .findByRunIdAndSkillTypeAndDeletedFalse(runId(), type)
                .orElseGet(() -> {
                    PveRunSkill sk = new PveRunSkill();
                    sk.setRunId(runId());
                    sk.setSkillType(type);
                    return sk;
                });
        skill.setQuantity(quantity);
        skillRepository.save(skill);
    }

    public int skillQuantity(SkillType type) {
        return skillRepository.findByRunIdAndSkillTypeAndDeletedFalse(runId(), type)
                .map(PveRunSkill::getQuantity)
                .orElse(0);
    }

    public void grantRelic(PveRelicType type) {
        if (relicRepository.existsByRunIdAndRelicTypeAndDeletedFalse(runId(), type)) {
            return;
        }
        PveRunRelic relic = new PveRunRelic();
        relic.setRunId(runId());
        relic.setRelicType(type);
        relic.setAcquiredAt(Instant.now());
        relicRepository.save(relic);
    }

    /**
     * Seam: overwrite the CURRENT run's seed BEFORE jumping to an encounter,
     * pinning every seed-derived draw (template pool, D4 transform, eruption
     * centers) for fixtures whose hardcoded coordinates must provably avoid
     * the level's real shape windows. Must be called before the target
     * encounter is created — already-created encounters keep their old plan.
     */
    public void pinRunSeed(String seed) {
        PveRun run = run();
        run.setSeed(seed);
        runRepository.save(run);
    }

    /**
     * Seam: jump the run to encounter {@code sequence} as if the previous
     * encounters were cleared (reached = sequence-1); creates the encounter
     * through the real scheduler so field/mutation stay seed-authentic.
     */
    public void jumpToEncounter(int sequence) {
        PveRun run = run();
        run.setCurrentEncounterSequence(sequence);
        run.setReachedEncounterSequence(sequence - 1);
        runRepository.save(run);
        PveEncounter encounter = encounterRepository
                .findByRunIdAndSequenceAndDeletedFalse(run.getId(), sequence)
                .orElseGet(() -> challengeService.createEncounter(run, sequence));
        ctx.putMemo("pve:encounterId", encounter.getId());
    }

    /**
     * Clear the current encounter cheaply, branching on encounter type
     * (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §1.0): PUZZLE completes
     * its own designed solution (07-08 doc: complete every non-backup
     * pre-placed shape's missing cell(s) — always within budget by design);
     * DUEL force-clears directly through the real economy/shop/run-settlement
     * side effects ({@link #forceWinCurrentDuelEncounter}) since this helper
     * exists purely to ADVANCE unrelated feature tests (economy, shop,
     * run-end) past a boss-duel level, not to exercise the duel itself — the
     * duel's actual win-rate is validated separately by
     * BossDuelStatisticsSteps using the real BossAiPolicy + a reference
     * player policy.
     */
    public void clearCurrentEncounterCheaply(String user) {
        if (encounter().getEncounterType() == PveEncounterType.DUEL) {
            forceWinCurrentDuelEncounter();
        } else {
            completeCurrentEncounterShapes(user);
        }
        Assertions.assertThat(encounter().getStatus().name()).isEqualTo("CLEARED");
    }

    /**
     * Force-clears the CURRENT DUEL encounter through the real
     * {@link PveChallengeService#onEncounterCleared} side effects (gold
     * award, reach advance, shop-open/run-WON) without actually playing out
     * the duel — see {@link #clearCurrentEncounterCheaply} javadoc for why
     * this is the right seam for generic test advancement instead of a real
     * playthrough.
     */
    public void forceWinCurrentDuelEncounter() {
        PveRun currentRun = run();
        PveEncounter currentEncounter = encounter();
        challengeService.onEncounterCleared(currentRun, currentEncounter);
        runRepository.save(currentRun);
        encounterRepository.save(currentEncounter);
    }

    /** Rebuilds the CURRENT encounter's authoritative board (same reconstruction PveChallengeService itself uses). */
    public SeriousBoard currentBoard() {
        List<PveFieldCell> cells = fieldCellRepository.findByEncounterIdAndDeletedFalse(encounterId());
        List<PveEncounterMove> encounterMoves = moveRepository
                .findByEncounterIdOrderByEncounterMoveNumberAsc(encounterId());
        List<com.gomoku.domain.entity.PveEncounterEvent> encounterEvents = eventRepository
                .findByEncounterIdOrderByOccurredAtAscIdAsc(encounterId());
        return PveBoardReplayer.rebuild(cells, encounterMoves, encounterEvents, objectMapper);
    }

    /**
     * Plays the CURRENT DUEL encounter to completion using
     * {@link ReferencePlayerPolicy} for the player (BLACK) against the REAL
     * API — the real {@code BossAiPolicy} replies via the server's own
     * placeMove flow, exactly as a live client would. Returns true iff the
     * encounter ended CLEARED (player won five-in-a-row); false on FAILED
     * (boss five or moves exhausted). Used by the DUEL win-rate statistic
     * (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §4.2) — deliberately NOT
     * used by {@link #clearCurrentEncounterCheaply}'s generic advancement
     * helper, which force-clears instead (see its javadoc).
     */
    public boolean playDuelToCompletion(String user) {
        return playDuelToCompletion(user, ReferencePlayerPolicy::nextMove);
    }

    /**
     * Same as {@link #playDuelToCompletion(String)} but with the player-side
     * policy parameterized (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §6.4
     * "普通玩家" statistical baseline) — lets the DUEL win-rate statistic drive
     * either {@link ReferencePlayerPolicy} (VCF+VCT-lite forcing search) or
     * {@code OrdinaryPlayerPolicy} (no search, basic reflexes only) through
     * the exact same real-API loop.
     */
    public boolean playDuelToCompletion(String user, DuelPlayerPolicy policy) {
        int guard = 0;
        while (encounter().getStatus() == PveEncounterStatus.IN_PROGRESS && guard++ < 400) {
            SeriousBoard board = currentBoard();
            boolean horizontalDisabled = encounter().getSequence() == 3;
            int[] move = policy.nextMove(board, StoneColor.BLACK, horizontalDisabled);
            ResponseEntity<Map> resp = placeMoveApi(user, move[0], move[1]);
            if (!resp.getStatusCode().is2xxSuccessful()) {
                throw new AssertionError("player policy move (" + move[0] + "," + move[1]
                        + ") rejected: " + resp.getBody());
            }
        }
        return encounter().getStatus() == PveEncounterStatus.CLEARED;
    }

    /** The move count the CURRENT encounter's designed solution needs (sum of every non-backup shape's completion cells). */
    public int currentEncounterSolutionMoveCount() {
        int total = 0;
        for (PveFieldScheduler.ShapeSpec shape : activeShapeSpecs()) {
            if (!shape.backup()) {
                total += shape.completionCells().size();
            }
        }
        return total;
    }

    private List<PveFieldScheduler.ShapeSpec> activeShapeSpecs() {
        PveEncounter encounter = encounter();
        return PveFieldScheduler.activeShapes(run().getSeed(), encounter.getSequence());
    }

    private Set<Long> activeShapeWindowCells() {
        Set<Long> cells = new HashSet<>();
        for (PveFieldScheduler.ShapeSpec shape : activeShapeSpecs()) {
            for (int[] rc : shape.windowCells()) {
                cells.add(key(rc[0], rc[1]));
            }
        }
        return cells;
    }

    /**
     * Completes every non-backup shape of the CURRENT encounter via its
     * designed solution, handling two real disruptions inline: ABYSS (level
     * 8) spawning a white obstacle right on a target cell (precision-snipe
     * it, granting the skill on demand — the design's own stated mitigation,
     * §3) and RAGE (level 6) clearing one of a shape's own already-placed
     * stones before its line completes (re-place any missing window cell —
     * repair — until the shape's line actually RESOLVES, §4).
     *
     * 2026-07-09 調校輪2: the old flow placed each completion cell exactly
     * once and moved on. Under RAGE's new 3-move cadence an eruption fires
     * DURING a shape's fill sequence far more often, and blasting a
     * just-repaired cell between the repair and the gap placement left the
     * gap sitting in a broken window — no line, no damage, encounter quietly
     * stuck IN_PROGRESS until the budget ran out. The per-shape loop below
     * re-reads the real board after every placement and keeps repairing +
     * re-placing until a LINE_RESOLVED event lands for the encounter (or the
     * encounter leaves IN_PROGRESS) — exactly the "重下被炸掉的部分" reaction
     * the design doc §4 expects of a live player.
     */
    public void completeCurrentEncounterShapes(String user) {
        List<PveFieldScheduler.ShapeSpec> shapes = activeShapeSpecs();
        Set<Long> allWindowCells = activeShapeWindowCells();
        for (PveFieldScheduler.ShapeSpec shape : shapes) {
            if (shape.backup()) {
                continue;
            }
            if (encounter().getStatus() != PveEncounterStatus.IN_PROGRESS) {
                break;
            }
            int resolvedBefore = lineResolvedCount();
            int guard = 0;
            while (encounter().getStatus() == PveEncounterStatus.IN_PROGRESS
                    && lineResolvedCount() == resolvedBefore
                    && guard++ < 30) {
                ensureShapeFilled(user, shape);
                if (encounter().getStatus() != PveEncounterStatus.IN_PROGRESS
                        || lineResolvedCount() != resolvedBefore) {
                    break; // a repair move itself completed the line (or ended the encounter)
                }
                Set<Long> stones = stoneKeys(getEncounterApi(user));
                boolean placedAny = false;
                for (int[] target : shape.completionCells()) {
                    if (!stones.contains(key(target[0], target[1]))) {
                        placeOrSnipe(user, target[0], target[1], allWindowCells);
                        placedAny = true;
                        break; // re-read the real board before the next placement
                    }
                }
                if (!placedAny) {
                    break; // every window cell already present without a resolution — nothing left to place
                }
            }
        }
    }

    /** LINE_RESOLVED event count for the CURRENT encounter (authoritative "did the line actually settle" signal). */
    private int lineResolvedCount() {
        return eventRepository.findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                encounterId(), PveEncounterEventType.LINE_RESOLVED).size();
    }

    private void ensureShapeFilled(String user, PveFieldScheduler.ShapeSpec shape) {
        Set<Long> stones = stoneKeys(getEncounterApi(user));
        for (int[] rc : shape.filledCells()) {
            long k = key(rc[0], rc[1]);
            if (!stones.contains(k)) {
                ResponseEntity<Map> resp = placeMoveApi(user, rc[0], rc[1]);
                Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                        .as("repair move (%d,%d) must succeed: %s", rc[0], rc[1], resp.getBody())
                        .isTrue();
                stones.add(k);
            }
        }
    }

    private void placeOrSnipe(String user, int row, int col, Set<Long> allWindowCells) {
        Map<String, Object> state = getEncounterApi(user);
        if (!obstacleKeys(state).contains(key(row, col))) {
            ResponseEntity<Map> resp = placeMoveApi(user, row, col);
            if (resp.getStatusCode().is2xxSuccessful()) {
                return;
            }
            if (encounter().getStatus() != PveEncounterStatus.IN_PROGRESS) {
                return; // boss already died from an earlier shape's resolution
            }
            throw new AssertionError("designed move (" + row + "," + col + ") failed: " + resp.getBody());
        }
        if (skillQuantity(SkillType.PRECISION_SNIPE) <= 0) {
            grantSkill(SkillType.PRECISION_SNIPE, 20);
        }
        ResponseEntity<Map> snipe = useSkillApi(user, snipeBody(row, col));
        if (snipe.getStatusCode().is2xxSuccessful()) {
            return;
        }
        // Interval already used this turn — open a fresh one with one harmless
        // filler move (outside every shape's window), then retry the snipe.
        int[] filler = findFillerCell(user, allWindowCells);
        Assertions.assertThat(placeMoveApi(user, filler[0], filler[1]).getStatusCode().is2xxSuccessful())
                .as("filler move to open a new skill interval must succeed").isTrue();
        ResponseEntity<Map> retry = useSkillApi(user, snipeBody(row, col));
        Assertions.assertThat(retry.getStatusCode().is2xxSuccessful())
                .as("snipe retry must succeed: %s", retry.getBody()).isTrue();
    }

    private String snipeBody(int row, int col) {
        return String.format("{\"skillType\":\"PRECISION_SNIPE\",\"target\":{\"row\":%d,\"col\":%d}}", row, col);
    }

    private int[] findFillerCell(String user, Set<Long> allWindowCells) {
        Map<String, Object> state = getEncounterApi(user);
        Set<Long> occupied = new HashSet<>();
        occupied.addAll(stoneKeys(state));
        occupied.addAll(obstacleKeys(state));
        for (int r = 0; r < 11; r++) {
            for (int c = 0; c < 11; c++) {
                long k = key(r, c);
                if (!occupied.contains(k) && !allWindowCells.contains(k)) {
                    return new int[]{r, c};
                }
            }
        }
        throw new AssertionError("no filler cell available outside every shape window");
    }

    /** Places `count` filler stones, never touching any active shape's 5-cell window. */
    public void placeSafeFillers(String user, int count) {
        Set<Long> avoid = activeShapeWindowCells();
        for (int i = 0; i < count; i++) {
            int[] cell = findFillerCell(user, avoid);
            Assertions.assertThat(placeMoveApi(user, cell[0], cell[1]).getStatusCode().is2xxSuccessful())
                    .as("safe filler move (%d,%d) must succeed", cell[0], cell[1]).isTrue();
        }
    }

    /** Advance through cleared encounters + shop skips until currentSequence == target. */
    public void advanceToEncounter(String user, int target) {
        while (run().getCurrentEncounterSequence() < target) {
            clearCurrentEncounterCheaply(user);
            ResponseEntity<Map> resp = skipShopApi(user);
            Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                    .as("shop skip must succeed: %s", resp.getBody())
                    .isTrue();
        }
    }

    public void ensureShopOpen(String user) {
        boolean open = shopVisitRepository
                .findFirstByRunIdAndStatusAndDeletedFalseOrderByAfterEncounterSequenceDesc(
                        runId(), com.gomoku.domain.enums.PveShopVisitStatus.OPEN)
                .isPresent();
        if (!open) {
            clearCurrentEncounterCheaply(user);
        }
    }

    // ────────────────────────── last-response accessors ──────────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> lastState() {
        return (Map<String, Object>) ctx.getMemo("pve:lastState");
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> lastResolution() {
        Map<String, Object> state = lastState();
        return state == null ? null : (Map<String, Object>) state.get("lastResolution");
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> resolvedLines() {
        Map<String, Object> resolution = lastResolution();
        return resolution == null ? List.of() : (List<Map<String, Object>>) resolution.get("linesResolved");
    }

    @SuppressWarnings("unchecked")
    public Set<Long> stoneKeys(Map<String, Object> state) {
        Set<Long> keys = new HashSet<>();
        List<Map<String, Object>> stones = (List<Map<String, Object>>) state.get("stones");
        if (stones != null) {
            for (Map<String, Object> s : stones) {
                keys.add(key(((Number) s.get("row")).intValue(), ((Number) s.get("col")).intValue()));
            }
        }
        return keys;
    }

    @SuppressWarnings("unchecked")
    public Set<Long> obstacleKeys(Map<String, Object> state) {
        Set<Long> keys = new HashSet<>();
        List<Map<String, Object>> cells = (List<Map<String, Object>>) state.get("obstacles");
        if (cells != null) {
            for (Map<String, Object> s : cells) {
                keys.add(key(((Number) s.get("row")).intValue(), ((Number) s.get("col")).intValue()));
            }
        }
        return keys;
    }

    public ResponseEntity<?> lastResponse() {
        return ctx.getLastResponse();
    }

    public ScenarioContext ctx() {
        return ctx;
    }

    public CommonGiven common() {
        return commonGiven;
    }

    public TestRestTemplate rest() {
        return restTemplate;
    }

    public PveRunRepository runs() {
        return runRepository;
    }

    public PveEncounterRepository encounters() {
        return encounterRepository;
    }

    public PveEncounterMoveRepository moves() {
        return moveRepository;
    }

    public PveEncounterEventRepository events() {
        return eventRepository;
    }

    public PveFieldCellRepository fieldCells() {
        return fieldCellRepository;
    }

    public PveFieldStateRepository fieldStates() {
        return fieldStateRepository;
    }

    public PveRunSkillRepository skills() {
        return skillRepository;
    }

    public PveRunRelicRepository relics() {
        return relicRepository;
    }

    public PveShopVisitRepository shopVisits() {
        return shopVisitRepository;
    }

    public PveChallengeService challenge() {
        return challengeService;
    }
}
