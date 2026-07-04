package com.gomoku.game;

import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.FieldType;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Random field generation at game creation (req #39 #40):
 *  - VOLCANO: 5–8 visible obstacle cells + up to 5 hidden one-time eruption cells;
 *  - BEACH: random sea side + up to 5 hidden one-time tide cells.
 * Hidden cells are server-only until triggered (req #44).
 */
public final class FieldGenerator {

    public static final int MAX_HIDDEN_CELLS = 5;
    public static final int MIN_OBSTACLES = 5;
    public static final int MAX_OBSTACLES = 8;

    public record GeneratedCell(FieldCellKind kind, int row, int col, boolean visible) {
    }

    public record GeneratedField(FieldType fieldType, BoardSide seaSide, List<GeneratedCell> cells) {
    }

    private final SecureRandom random = new SecureRandom();

    public GeneratedField generate(FieldType fieldType) {
        int size = FieldGeometry.boardSize(fieldType);
        List<GeneratedCell> cells = new ArrayList<>();
        Set<Integer> taken = new HashSet<>();

        if (fieldType == FieldType.VOLCANO) {
            int obstacleCount = MIN_OBSTACLES + random.nextInt(MAX_OBSTACLES - MIN_OBSTACLES + 1);
            for (int[] pos : pickDistinct(obstacleCount, size, taken)) {
                cells.add(new GeneratedCell(FieldCellKind.OBSTACLE, pos[0], pos[1], true));
            }
            for (int[] pos : pickDistinct(MAX_HIDDEN_CELLS, size, taken)) {
                cells.add(new GeneratedCell(FieldCellKind.ERUPTION, pos[0], pos[1], false));
            }
            return new GeneratedField(fieldType, null, cells);
        }

        // BEACH: ocean side random; hidden tide cells anywhere on the board.
        BoardSide seaSide = BoardSide.values()[random.nextInt(BoardSide.values().length)];
        for (int[] pos : pickDistinct(MAX_HIDDEN_CELLS, size, taken)) {
            cells.add(new GeneratedCell(FieldCellKind.TIDE, pos[0], pos[1], false));
        }
        return new GeneratedField(fieldType, seaSide, cells);
    }

    private List<int[]> pickDistinct(int count, int size, Set<Integer> taken) {
        List<int[]> picked = new ArrayList<>(count);
        while (picked.size() < count) {
            int r = random.nextInt(size);
            int c = random.nextInt(size);
            int key = r * size + c;
            if (taken.add(key)) {
                picked.add(new int[]{r, c});
            }
        }
        return picked;
    }
}
