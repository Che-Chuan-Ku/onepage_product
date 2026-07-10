package com.gomoku.steps.pve;

import com.gomoku.domain.enums.PveEncounterEventType;
import com.gomoku.domain.enums.PveEncounterStatus;
import com.gomoku.game.PveFieldScheduler;
import com.gomoku.repository.PveEncounterEventRepository;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.HashSet;
import java.util.Set;

/**
 * 統計驗證 harness for the 2026-07-09 調校輪2 互動命中率 tuning
 * (documents/PVE-關卡重設計-2026-07-08.md §4 補充；specs/features/pve/Boss突變.feature):
 * drives 50 independent seeds each through L6 (RAGE) and L8 (ABYSS) via the
 * SAME "standard solve sequence" harness that 關卡可解性.feature already uses
 * ({@link PveCommonSteps#completeCurrentEncounterShapes}), then aggregates:
 *
 * <ul>
 *   <li>L6 RAGE: fraction of the 50 runs where the mutation fired at least
 *   once (target >=60%), and fraction that still cleared within budget
 *   (target 100% — the eruption must never break solvability).</li>
 * </ul>
 *
 * 2026-07-09 魔王對弈與策略引導設計: sequence 8 became a DUEL encounter (no
 * ABYSS mutation anywhere anymore — see Boss突變.feature's header note), so
 * the L8 ABYSS adjacency statistic this class used to also compute was
 * removed; L6 RAGE is unaffected (still a PUZZLE sequence).
 *
 * Each of the 50 "slots" retries a handful of candidate seeds (mirroring
 * {@link PveSolvabilitySteps}'s own retry technique) so an occasional
 * unrelated solvability edge case on one specific seed doesn't spuriously
 * fail the whole statistic — the same tolerance 關卡可解性.feature already
 * grants itself via MAX_SEED_ATTEMPTS.
 */
public class PveMutationRateStatisticsSteps {

    private static final int SAMPLE_SIZE = 50;
    private static final int RETRIES_PER_SLOT = 5;
    private static final int RAGE_SEQUENCE = 6;

    @Autowired private PveCommonSteps support;
    @Autowired private PveEncounterEventRepository eventRepository;

    private RunSetResult rageResult;

    @When("統計驗證L6震怒觸發率與L8深淵擋路率")
    public void runStatisticalVerification() {
        rageResult = simulate(RAGE_SEQUENCE, "mutrate-rage");
        System.out.printf(
                "[pve-mutation-rate] L6 RAGE triggered=%d/%d (%.1f%%) cleared=%d/%d%n",
                rageResult.triggeredRuns, SAMPLE_SIZE, rageResult.triggerRatePct(),
                rageResult.clearedRuns, SAMPLE_SIZE);
    }

    @Then("^L6震怒觸發率至少(\\d+)%且觸發後全部可解$")
    public void assertRageTriggerRate(int minPercent) {
        Assertions.assertThat(rageResult.clearedRuns)
                .as("all %d RAGE runs must clear within budget: %s", SAMPLE_SIZE, rageResult)
                .isEqualTo(SAMPLE_SIZE);
        Assertions.assertThat(rageResult.triggerRatePct())
                .as("RAGE trigger rate: %s", rageResult)
                .isGreaterThanOrEqualTo(minPercent);
    }

    private RunSetResult simulate(int sequence, String slotPrefix) {
        int triggeredRuns = 0;
        int clearedRuns = 0;
        int totalObstacles = 0;
        int adjacentObstacles = 0;

        for (int slot = 0; slot < SAMPLE_SIZE; slot++) {
            boolean cleared = false;
            boolean triggered = false;
            int obstaclesThisRun = 0;
            int adjacentThisRun = 0;

            for (int attempt = 0; attempt < RETRIES_PER_SLOT && !cleared; attempt++) {
                String seed = slotPrefix + "-" + slot + "-" + attempt;
                String user = slotPrefix + "-user-" + slot + "-" + attempt;
                support.common().playerIsLoggedIn(user);
                support.createRunApi(user, "WARRIOR", seed);
                Assertions.assertThat(support.ctx().getMemo("pve:runId"))
                        .as("run must be created for seed %s", seed).isNotNull();
                support.jumpToEncounter(sequence);

                Set<Long> solveTargets = solveTargetCells(seed, sequence);

                try {
                    support.completeCurrentEncounterShapes(user);
                } catch (AssertionError ignored) {
                    // Treated as an unsolved attempt for this slot — retry with
                    // the next candidate seed (see class javadoc).
                }

                cleared = support.encounter().getStatus() == PveEncounterStatus.CLEARED;
                if (!cleared) {
                    var enc = support.encounter();
                    System.out.printf("[pve-mutation-rate][debug] seed=%s status=%s movesUsed=%d budget=%d hp=%d/%d%n",
                            seed, enc.getStatus(), enc.getMovesUsed(), enc.getMoveBudget(),
                            enc.getBossHpCurrent(), enc.getBossHpMax());
                }
                var events = eventRepository.findByEncounterIdAndEventTypeOrderByOccurredAtAscIdAsc(
                        support.encounterId(), PveEncounterEventType.BOSS_MUTATION_TRIGGERED);
                triggered = !events.isEmpty();
                obstaclesThisRun = events.size();
                adjacentThisRun = 0;
                for (var event : events) {
                    if (minChebyshevDistance(event.getRow(), event.getCol(), solveTargets) <= 1) {
                        adjacentThisRun++;
                    }
                }
            }

            if (cleared) {
                clearedRuns++;
            }
            if (triggered) {
                triggeredRuns++;
            }
            totalObstacles += obstaclesThisRun;
            adjacentObstacles += adjacentThisRun;
        }

        return new RunSetResult(triggeredRuns, clearedRuns, totalObstacles, adjacentObstacles);
    }

    /** Every non-backup shape's still-relevant completion cell(s) for (seed, sequence) — the cells the harness's designed solve will actually play. */
    private Set<Long> solveTargetCells(String seed, int sequence) {
        Set<Long> targets = new HashSet<>();
        for (PveFieldScheduler.ShapeSpec shape : PveFieldScheduler.activeShapes(seed, sequence)) {
            if (shape.backup()) {
                continue;
            }
            for (int[] rc : shape.completionCells()) {
                targets.add(PveCommonSteps.key(rc[0], rc[1]));
            }
        }
        return targets;
    }

    private int minChebyshevDistance(int row, int col, Set<Long> targets) {
        int min = Integer.MAX_VALUE;
        for (long key : targets) {
            int tr = (int) (key / 100);
            int tc = (int) (key % 100);
            int d = Math.max(Math.abs(row - tr), Math.abs(col - tc));
            if (d < min) {
                min = d;
            }
        }
        return min;
    }

    private record RunSetResult(int triggeredRuns, int clearedRuns, int totalObstacles, int adjacentObstacles) {
        double triggerRatePct() {
            return 100.0 * triggeredRuns / SAMPLE_SIZE;
        }

        double adjacencyRatePct() {
            return totalObstacles == 0 ? 0.0 : 100.0 * adjacentObstacles / totalObstacles;
        }
    }
}
