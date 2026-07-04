package com.gomoku.game;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * Self-contained JSON payload for field_events.detail (server-side only, never
 * sent to clients). Together with the moves stream it makes board state fully
 * reconstructible (see BoardReplayer). One flexible shape covers all types:
 *  - STONE_PUSHED:            fromRow/fromCol/toRow/toCol/color
 *  - STONE_REMOVED_OFF_BOARD: row/col/color
 *  - STONES_BURNED / STONES_CLEARED: cells[{row,col,color}]
 *  - COLORS_SWAPPED:          cells[{row,col,fromColor,toColor}]
 *  - STONE_REPLACED:          row/col/fromColor/toColor
 *  - SAND_ERODED:             line (row/col index) — informational
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record FieldEventDetail(
        Integer fromRow,
        Integer fromCol,
        Integer toRow,
        Integer toCol,
        Integer row,
        Integer col,
        String color,
        String fromColor,
        String toColor,
        Integer line,
        List<FieldEventDetail> cells
) {
    public static FieldEventDetail pushed(int fromRow, int fromCol, int toRow, int toCol, String color) {
        return new FieldEventDetail(fromRow, fromCol, toRow, toCol, null, null, color, null, null, null, null);
    }

    public static FieldEventDetail removed(int row, int col, String color) {
        return new FieldEventDetail(null, null, null, null, row, col, color, null, null, null, null);
    }

    public static FieldEventDetail cell(int row, int col, String color) {
        return new FieldEventDetail(null, null, null, null, row, col, color, null, null, null, null);
    }

    public static FieldEventDetail swapped(int row, int col, String fromColor, String toColor) {
        return new FieldEventDetail(null, null, null, null, row, col, null, fromColor, toColor, null, null);
    }

    public static FieldEventDetail replaced(int row, int col, String fromColor, String toColor) {
        return new FieldEventDetail(null, null, null, null, row, col, null, fromColor, toColor, null, null);
    }

    public static FieldEventDetail cellList(List<FieldEventDetail> cells) {
        return new FieldEventDetail(null, null, null, null, null, null, null, null, null, null, cells);
    }

    public static FieldEventDetail erodedLine(int line) {
        return new FieldEventDetail(null, null, null, null, null, null, null, null, null, line, null);
    }
}
