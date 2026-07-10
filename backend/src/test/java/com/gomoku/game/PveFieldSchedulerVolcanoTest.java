package com.gomoku.game;

import com.gomoku.domain.enums.FieldCellKind;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

/**
 * §7.6 L5 岩石覆蓋下限 (2026-07-10 第二批 polish) generation test — pure JUnit,
 * no Spring/DB: over many seeds, the L5 VOLCANO one-shot rock layout must
 * always place at least 1 rock strictly in EACH half of the board (rows 0-4
 * and rows 6-10, split at the middle row 5), never clustering the whole
 * terrain on a single side; count (5-8), kind (OBSTACLE), visibility and
 * distinctness invariants are asserted alongside, plus determinism (same seed
 * → identical layout).
 */
class PveFieldSchedulerVolcanoTest {

    private static final int SEEDS = 300;
    private static final int MIDDLE_ROW = PveFieldGeometry.BOARD_SIZE / 2;

    @Test
    void l5RocksAlwaysCoverBothBoardHalves() {
        for (int i = 0; i < SEEDS; i++) {
            String seed = "volcano-halfboard-seed-" + i;
            PveFieldScheduler.EncounterPlan plan = PveFieldScheduler.plan(seed, 5);

            Assertions.assertThat(plan.cells())
                    .as("seed %s: every L5 field cell is a visible OBSTACLE rock", seed)
                    .allSatisfy(cell -> {
                        Assertions.assertThat(cell.kind()).isEqualTo(FieldCellKind.OBSTACLE);
                        Assertions.assertThat(cell.visible()).isTrue();
                        Assertions.assertThat(cell.row()).isBetween(0, PveFieldGeometry.BOARD_SIZE - 1);
                        Assertions.assertThat(cell.col()).isBetween(0, PveFieldGeometry.BOARD_SIZE - 1);
                    });
            Assertions.assertThat(plan.cells().size())
                    .as("seed %s: rock count stays in the 5-8 design range", seed)
                    .isBetween(5, 8);

            Set<Long> distinct = new HashSet<>();
            boolean topHalf = false;
            boolean bottomHalf = false;
            for (PveFieldScheduler.PlannedCell cell : plan.cells()) {
                Assertions.assertThat(distinct.add(cell.row() * 100L + cell.col()))
                        .as("seed %s: rocks must not overlap (%d,%d)", seed, cell.row(), cell.col())
                        .isTrue();
                if (cell.row() < MIDDLE_ROW) {
                    topHalf = true;
                } else if (cell.row() > MIDDLE_ROW) {
                    bottomHalf = true;
                }
            }
            Assertions.assertThat(topHalf)
                    .as("seed %s: at least 1 rock strictly above the middle row", seed).isTrue();
            Assertions.assertThat(bottomHalf)
                    .as("seed %s: at least 1 rock strictly below the middle row", seed).isTrue();
        }
    }

    @Test
    void l5RockLayoutIsSeedDeterministic() {
        PveFieldScheduler.EncounterPlan first = PveFieldScheduler.plan("volcano-determinism-seed", 5);
        PveFieldScheduler.EncounterPlan second = PveFieldScheduler.plan("volcano-determinism-seed", 5);
        Assertions.assertThat(second.cells()).isEqualTo(first.cells());
    }
}
