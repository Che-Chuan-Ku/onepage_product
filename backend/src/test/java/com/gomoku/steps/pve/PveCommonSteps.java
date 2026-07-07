package com.gomoku.steps.pve;

import com.gomoku.cucumber.ScenarioContext;
import com.gomoku.domain.entity.PveEncounter;
import com.gomoku.domain.entity.PveFieldCell;
import com.gomoku.domain.entity.PveRun;
import com.gomoku.domain.entity.PveRunRelic;
import com.gomoku.domain.entity.PveRunSkill;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.PveEncounterEventType;
import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.SkillType;
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

    // ────────────────────────── backgrounds ──────────────────────────────────

    @Given("^一場PVE挑戰對局進行中，棋盤11×11，倍率為 1\\.0$")
    public void pveGameInProgressWithBoard() {
        startRun("alice", "WARRIOR");
    }

    @Given("一場PVE挑戰對局進行中，第1關 BossHP 100，手數預算30")
    public void pveGameInProgressFirstEncounter() {
        startRun("alice", "WARRIOR");
    }

    @Given("一場PVE挑戰對局進行中，玩家 {string} 職業為 {string}")
    public void pveGameInProgressWithClass(String user, String classType) {
        startRun(user, classType);
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

    private int[] findVerticalSegment(Set<Long> blocked) {
        for (int col = 0; col < 11; col++) {
            for (int startRow = 0; startRow + 4 < 11; startRow++) {
                boolean ok = true;
                for (int r = Math.max(0, startRow - 1); r <= Math.min(10, startRow + 5) && ok; r++) {
                    for (int c = Math.max(0, col - 1); c <= Math.min(10, col + 1) && ok; c++) {
                        if (blocked.contains(key(r, c))) {
                            ok = false;
                        }
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

    /** Clear the current encounter with one clean 5-line (HP lowered to 50 first). */
    public void clearCurrentEncounterCheaply(String user) {
        PveEncounter encounter = encounter();
        if (encounter.getBossHpCurrent() > 50) {
            encounter.setBossHpCurrent(50);
            encounterRepository.save(encounter);
        }
        playCleanVerticalLine(user);
        Assertions.assertThat(encounter().getStatus().name()).isEqualTo("CLEARED");
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
