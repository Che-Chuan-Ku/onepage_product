package com.gomoku.game;

import com.gomoku.domain.enums.SkillDirection;
import com.gomoku.domain.enums.StoneColor;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Shared chain-push solver (req #38, Q3) used by horizontal/vertical slash and
 * the beach wave:
 *  - destination occupied → the whole contiguous line pushes one cell (chain);
 *  - line end pushed off-board → that stone is removed;
 *  - an obstacle at the chain's destination → the whole line stays put.
 * Mutates the given board and reports each stone movement/removal.
 */
public final class PushResolver {

    /** One stone moved from (fromRow,fromCol) to (toRow,toCol). */
    public record Pushed(int fromRow, int fromCol, int toRow, int toCol, StoneColor color) {
    }

    /** One stone pushed off-board from (row,col). */
    public record Removed(int row, int col, StoneColor color) {
    }

    public record Outcome(List<Pushed> pushed, List<Removed> removed) {
        public boolean anyMoved() {
            return !pushed.isEmpty() || !removed.isEmpty();
        }
    }

    private PushResolver() {
    }

    /**
     * Push every source cell (that currently holds a stone) one step in
     * {@code dir}, chaining through contiguous stones. Sources are processed
     * front-most (deepest along the direction) first so each stone moves at
     * most once even when several sources share a line (wave case).
     */
    public static Outcome push(SeriousBoard board, List<int[]> sources, SkillDirection dir) {
        List<Pushed> pushed = new ArrayList<>();
        List<Removed> removed = new ArrayList<>();
        int dr = dir.dRow();
        int dc = dir.dCol();

        List<int[]> ordered = new ArrayList<>(sources);
        ordered.sort(Comparator.comparingInt((int[] p) -> p[0] * dr + p[1] * dc).reversed());

        for (int[] src : ordered) {
            int r = src[0];
            int c = src[1];
            if (!board.inBounds(r, c) || !board.hasStone(r, c)) {
                continue; // empty source cell exerts no push
            }
            // Walk the contiguous stone chain from the source in push direction.
            // chainLen = number of consecutive stones starting at the source.
            int chainLen = 1;
            while (board.inBounds(r + chainLen * dr, c + chainLen * dc)
                    && board.hasStone(r + chainLen * dr, c + chainLen * dc)) {
                chainLen++;
            }
            int nextR = r + chainLen * dr;
            int nextC = c + chainLen * dc;

            if (board.inBounds(nextR, nextC) && board.isObstacle(nextR, nextC)) {
                continue; // obstacle blocks: whole line stays (Q3)
            }

            // Shift stones one step, starting from the chain's far end.
            for (int i = chainLen - 1; i >= 0; i--) {
                int fromR = r + i * dr;
                int fromC = c + i * dc;
                int toR = fromR + dr;
                int toC = fromC + dc;
                StoneColor color = board.stoneAt(fromR, fromC);
                board.removeStone(fromR, fromC);
                if (board.inBounds(toR, toC)) {
                    board.setStone(toR, toC, color);
                    pushed.add(new Pushed(fromR, fromC, toR, toC, color));
                } else {
                    removed.add(new Removed(fromR, fromC, color)); // pushed off-board
                }
            }
        }
        return new Outcome(pushed, removed);
    }
}
