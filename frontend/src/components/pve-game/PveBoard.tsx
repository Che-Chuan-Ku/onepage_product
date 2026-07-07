"use client";

import { cellKey, cellSetFrom, PVE_BEACH_OCEAN_ROWS } from "@/lib/game/pveBoard";
import type { Cell, PveFieldType } from "@/lib/types/schemas";

interface PveBoardProps {
  rows: number;
  cols: number;
  stones: Cell[];
  obstacles: Cell[];
  fieldType: PveFieldType;
  /** Move-placement preview cursor (single cell, confirm-to-commit flow). */
  pendingCell: Cell | null;
  /** Cells already picked mid skill-flow (anchor/target/secondStone). */
  skillPreviewCells?: Cell[];
  /** false once the encounter has ended, or while a request is in flight. */
  interactive: boolean;
  onCellClick: (row: number, col: number) => void;
}

/**
 * DOM-grid PVE board (fixed 11x11 geometry).
 *
 * Deliberately NOT built on the existing Canvas `GomokuBoard`
 * (frontend/src/lib/game/GomokuBoard.ts, read-only reference per task scope):
 * that renderer is purpose-built for dual-color PVP stones, Swap2 preview and
 * duel skill VFX baked into its hit-testing math. PVE stones are single-color
 * / ownerless (api usage doc: PveEncounterStateResponse.stones has no `color`
 * field — the Boss never occupies a board cell) on a fixed 11x11 grid, a
 * different-enough contract that extending GomokuBoard would mean bolting
 * PVE-only concepts onto a file already carrying a lot of PVP-specific state.
 * A CSS-grid of buttons gives exact, dependency-free hit testing for e2e
 * (`data-testid="pve-cell-{row}-{col}"`) without replicating GomokuBoard's
 * canvas pixel math, at the cost of not reusing its rendering — an acceptable
 * trade for this increment's simpler visual bar (no dual-color stones, no
 * opening phase, no Swap2, no cast animations beyond CSS classes).
 */
export function PveBoard({
  rows,
  cols,
  stones,
  obstacles,
  fieldType,
  pendingCell,
  skillPreviewCells = [],
  interactive,
  onCellClick,
}: PveBoardProps) {
  const stoneSet = cellSetFrom(stones);
  const obstacleSet = cellSetFrom(obstacles);
  const previewSet = cellSetFrom(skillPreviewCells);

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = cellKey(r, c);
      const isStone = stoneSet.has(k);
      const isObstacle = obstacleSet.has(k);
      const isPending = pendingCell?.row === r && pendingCell?.col === c;
      const isSkillPick = previewSet.has(k);
      const isOcean = fieldType === "BEACH" && r < PVE_BEACH_OCEAN_ROWS;
      const cls = [
        "pveg-cell",
        isOcean ? "pveg-cell-ocean" : "",
        isObstacle ? "pveg-cell-obstacle" : "",
        isStone ? "pveg-cell-stone" : "",
        isPending ? "pveg-cell-pending" : "",
        isSkillPick ? "pveg-cell-skillpick" : "",
      ]
        .filter(Boolean)
        .join(" ");
      cells.push(
        <button
          key={k}
          type="button"
          className={cls}
          data-testid={`pve-cell-${r}-${c}`}
          disabled={!interactive}
          onClick={() => onCellClick(r, c)}
          aria-label={`row ${r} col ${c}`}
        >
          {isStone ? <span className="pveg-stone" /> : null}
          {isObstacle ? <span className="pveg-obstacle">◆</span> : null}
        </button>,
      );
    }
  }

  return (
    <div
      className={`pveg-board${fieldType === "VOLCANO" ? " pveg-board-volcano" : ""}${
        fieldType === "BEACH" ? " pveg-board-beach" : ""
      }`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      data-testid="pve-board"
    >
      {cells}
    </div>
  );
}
