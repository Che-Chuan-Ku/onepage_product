package com.gomoku.game;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.domain.entity.FieldCell;
import com.gomoku.domain.entity.FieldEvent;
import com.gomoku.domain.entity.Move;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.StoneColor;

import java.util.List;

/**
 * Rebuilds the current Serious Duel board from the immutable event streams:
 * moves (stone placements, in move_number order) interleaved with field_events
 * (pushes/burns/swaps/clears, in occurred_at order). An event with
 * move_number M applies after move M (events created by an ultimate cast carry
 * the move_count at cast time, so they order correctly as well).
 *
 * Placement semantics are "set cell" (a precision-snipe move overwrites the
 * enemy stone at the same cell), removals clear cells, pushes move stones.
 */
public final class BoardReplayer {

    private BoardReplayer() {
    }

    public static SeriousBoard rebuild(int size,
                                       List<FieldCell> fieldCells,
                                       List<Move> movesByNumberAsc,
                                       List<FieldEvent> eventsByOccurredAtAsc,
                                       ObjectMapper objectMapper) {
        SeriousBoard board = new SeriousBoard(size);
        for (FieldCell cell : fieldCells) {
            if (cell.getCellKind() == FieldCellKind.OBSTACLE) {
                board.setObstacle(cell.getRow(), cell.getCol());
            }
        }

        int eventIdx = 0;
        List<FieldEvent> events = eventsByOccurredAtAsc;

        // Events settled before any move (move_number null or 0).
        eventIdx = applyEventsUpTo(board, events, eventIdx, 0, objectMapper);

        for (Move move : movesByNumberAsc) {
            board.setStone(move.getRow(), move.getCol(), move.getColor());
            eventIdx = applyEventsUpTo(board, events, eventIdx, move.getMoveNumber(), objectMapper);
        }
        // Trailing events (defensive; settlement never outruns the last move).
        applyEventsUpTo(board, events, eventIdx, Integer.MAX_VALUE, objectMapper);
        return board;
    }

    private static int applyEventsUpTo(SeriousBoard board, List<FieldEvent> events, int fromIdx,
                                       int maxMoveNumber, ObjectMapper objectMapper) {
        int idx = fromIdx;
        while (idx < events.size()) {
            FieldEvent event = events.get(idx);
            int number = event.getMoveNumber() == null ? 0 : event.getMoveNumber();
            if (number > maxMoveNumber) {
                break;
            }
            applyEvent(board, event, objectMapper);
            idx++;
        }
        return idx;
    }

    private static void applyEvent(SeriousBoard board, FieldEvent event, ObjectMapper objectMapper) {
        FieldEventDetail detail = parseDetail(event, objectMapper);
        switch (event.getEventType()) {
            case STONE_PUSHED -> {
                if (detail != null && detail.fromRow() != null) {
                    board.removeStone(detail.fromRow(), detail.fromCol());
                    board.setStone(detail.toRow(), detail.toCol(), StoneColor.valueOf(detail.color()));
                }
            }
            case STONE_REMOVED_OFF_BOARD -> {
                if (detail != null && detail.row() != null) {
                    board.removeStone(detail.row(), detail.col());
                }
            }
            case STONES_BURNED, STONES_CLEARED -> {
                if (detail != null && detail.cells() != null) {
                    for (FieldEventDetail cell : detail.cells()) {
                        board.removeStone(cell.row(), cell.col());
                    }
                }
            }
            case COLORS_SWAPPED -> {
                if (detail != null && detail.cells() != null) {
                    for (FieldEventDetail cell : detail.cells()) {
                        board.setStone(cell.row(), cell.col(), StoneColor.valueOf(cell.toColor()));
                    }
                }
            }
            case STONE_REPLACED -> {
                if (detail != null && detail.row() != null && detail.toColor() != null) {
                    board.setStone(detail.row(), detail.col(), StoneColor.valueOf(detail.toColor()));
                }
            }
            // FIELD_GENERATED / VOLCANO_ERUPTED / WAVE_SURGED / TIDE_TRIGGERED /
            // TIDE_RISEN / SAND_ERODED carry no direct stone changes.
            default -> {
            }
        }
    }

    private static FieldEventDetail parseDetail(FieldEvent event, ObjectMapper objectMapper) {
        if (event.getDetail() == null || event.getDetail().isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(event.getDetail(), FieldEventDetail.class);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Corrupt field_events.detail for event " + event.getId(), e);
        }
    }
}
