package com.gomoku.game;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.domain.entity.PveEncounterEvent;
import com.gomoku.domain.entity.PveEncounterMove;
import com.gomoku.domain.entity.PveFieldCell;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.StoneColor;

import java.util.Comparator;
import java.util.List;

/**
 * Rebuilds the authoritative PVE board from the immutable event streams
 * (FR-B6 reconnect / resume). Convention: player stones = BLACK, abyss
 * obstacle stones = WHITE (pushable/removable but neither placeable-on nor
 * line-forming), volcano obstacles = static obstacle mask.
 *
 * Replay order: events are grouped by move_number — settlement events of move
 * m and interval-skill events cast after move m both carry m — so the stream
 * is applied as: [events m=0], move 1, [events m=1], move 2, ... with
 * occurred_at/id ordering within a group.
 */
public final class PveBoardReplayer {

    private PveBoardReplayer() {
    }

    public static SeriousBoard rebuild(List<PveFieldCell> fieldCells,
                                       List<PveEncounterMove> moves,
                                       List<PveEncounterEvent> events,
                                       ObjectMapper objectMapper) {
        SeriousBoard board = new SeriousBoard(PveFieldGeometry.BOARD_SIZE);
        for (PveFieldCell cell : fieldCells) {
            if (cell.getCellKind() == FieldCellKind.OBSTACLE) {
                board.setObstacle(cell.getRow(), cell.getCol());
            }
        }

        List<PveEncounterMove> orderedMoves = moves.stream()
                .sorted(Comparator.comparingInt(PveEncounterMove::getEncounterMoveNumber))
                .toList();
        List<PveEncounterEvent> orderedEvents = events.stream()
                .sorted(Comparator
                        .comparing((PveEncounterEvent e) -> e.getMoveNumber() == null ? 0 : e.getMoveNumber())
                        .thenComparing(PveEncounterEvent::getOccurredAt)
                        .thenComparing(PveEncounterEvent::getId))
                .toList();

        int eventIdx = 0;
        for (PveEncounterMove move : orderedMoves) {
            // Events belonging to intervals/settlements BEFORE this move.
            while (eventIdx < orderedEvents.size()
                    && groupOf(orderedEvents.get(eventIdx)) < move.getEncounterMoveNumber()) {
                apply(board, orderedEvents.get(eventIdx), objectMapper);
                eventIdx++;
            }
            board.setStone(move.getRow(), move.getCol(), StoneColor.BLACK);
        }
        while (eventIdx < orderedEvents.size()) {
            apply(board, orderedEvents.get(eventIdx), objectMapper);
            eventIdx++;
        }
        return board;
    }

    private static int groupOf(PveEncounterEvent event) {
        return event.getMoveNumber() == null ? 0 : event.getMoveNumber();
    }

    private static void apply(SeriousBoard board, PveEncounterEvent event, ObjectMapper objectMapper) {
        PveEventDetail detail = parse(event.getDetail(), objectMapper);
        switch (event.getEventType()) {
            case LINE_RESOLVED, VOLCANO_ERUPTED -> removeCells(board, detail);
            case SKILL_USED -> {
                if (detail != null) {
                    removeCells(board, detail);
                    if (detail.placed() != null) {
                        for (PveEventDetail.Cell cell : detail.placed()) {
                            board.setStone(cell.row(), cell.col(), colorOf(cell.color()));
                        }
                    }
                    if (detail.swapped() != null) {
                        for (PveEventDetail.Cell cell : detail.swapped()) {
                            board.setStone(cell.row(), cell.col(), colorOf(cell.color()));
                        }
                    }
                }
            }
            case STONES_PUSHED -> {
                if (detail != null && detail.pushes() != null) {
                    // Each stone moves exactly once per outcome; off-board removals
                    // were applied by earlier STONE_REMOVED_OFF_BOARD events, so a
                    // vacate-all-then-place-all pass is order-independent.
                    for (PveEventDetail.Push push : detail.pushes()) {
                        board.removeStone(push.fromRow(), push.fromCol());
                    }
                    for (PveEventDetail.Push push : detail.pushes()) {
                        board.setStone(push.toRow(), push.toCol(), colorOf(push.color()));
                    }
                }
            }
            case STONE_REMOVED_OFF_BOARD -> {
                if (event.getRow() != null && event.getCol() != null) {
                    board.removeStone(event.getRow(), event.getCol());
                }
            }
            case BOSS_MUTATION_TRIGGERED -> {
                if (detail != null && "RAGE".equals(detail.mutation())) {
                    removeCells(board, detail);
                } else if (event.getRow() != null && event.getCol() != null
                        && (detail == null || "ABYSS".equals(detail.mutation()))) {
                    board.setStone(event.getRow(), event.getCol(), StoneColor.WHITE);
                }
            }
            case WAVE_SURGED, TIDE_TRIGGERED, ENCOUNTER_CLEARED, ENCOUNTER_FAILED -> {
                // no board mutation
            }
        }
    }

    private static void removeCells(SeriousBoard board, PveEventDetail detail) {
        if (detail == null || detail.cells() == null) {
            return;
        }
        for (PveEventDetail.Cell cell : detail.cells()) {
            board.removeStone(cell.row(), cell.col());
        }
    }

    private static StoneColor colorOf(String color) {
        return color == null ? StoneColor.BLACK : StoneColor.valueOf(color);
    }

    private static PveEventDetail parse(String json, ObjectMapper objectMapper) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, PveEventDetail.class);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot parse pve event detail: " + json, e);
        }
    }
}
