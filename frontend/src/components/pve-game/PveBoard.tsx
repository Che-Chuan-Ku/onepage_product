"use client";

import { Board } from "@/components/Board";
import type { PlacedStone } from "@/lib/game/GomokuBoard";
import type { Cell, PveFieldType, PveObstacleCell } from "@/lib/types/schemas";

interface PveBoardProps {
  rows: number;
  cols: number;
  stones: Cell[];
  obstacles: PveObstacleCell[];
  fieldType: PveFieldType;
  /** Move-placement preview cursor (single cell, confirm-to-commit flow). */
  pendingCell: Cell | null;
  /** Cells already picked mid skill-flow (anchor/target/secondStone). */
  skillPreviewCells?: Cell[];
  /** DUEL only (§5.2): boss's most recent reply — short highlight, not a placement preview. */
  bossLastMove?: Cell | null;
  /** L8 SKILL_DEMON only (documents/PVE-全對弈階梯設計-2026-07-10.md §3/§9.2):
   * cells affected by the boss's most recent skill cast (this settlement's
   * `bossSkillEvents`) — highlighted the same way as `bossLastMove`, so the
   * player can see "the boss just sniped/scattered/pioneer-starred here"
   * without a bespoke new highlight channel. */
  bossSkillCells?: Cell[];
  /** L3 only (§4.1): true when this encounter's five-in-a-row judgement
   * excludes the horizontal direction — shows a persistent reminder banner. */
  horizontalDisabled?: boolean;
  /** L3 only (§7.6 item #2 即時回饋): cells of any horizontal five (either
   * color) that does NOT count as a win — grayed out + dashed strikethrough
   * on the canvas, plus an e2e DOM hook below. */
  voidLineCells?: Cell[];
  /** false once the encounter has ended, or while a request is in flight. */
  interactive: boolean;
  /** true while a skill flow is collecting coordinates (relaxes obstacle-click blocking below). */
  skillFlowActive?: boolean;
  onCellClick: (row: number, col: number) => void;
}

/**
 * PVE 棋盤關卡頁 board — thin wrapper around the shared canvas `GomokuBoard`
 * (via `<Board>`, frontend/src/components/Board.tsx), NOT a bespoke DOM grid
 * (documents/PVE-關卡重設計-2026-07-08.md §6 diff 清單 對接點): GomokuBoard
 * already supports a configurable `size` (11 here), dual-color stones,
 * `obstacles` rendering (volcano rocks / ABYSS enemy stones), and pointer
 * hit-testing on the line intersections — exactly what PVE needs, so this is
 * an interface adaptation, not a re-implementation.
 *
 * Mapping notes:
 *  - PVE stones are single-color / ownerless (PveEncounterStateResponse.stones
 *    has no `color` field) — rendered as BLACK via GomokuBoard's `stones` prop.
 *  - `obstacles[].kind` (2026-07-09 新增, documents/PVE-魔王對弈與策略引導設計-
 *    2026-07-09.md §5.2) 區分 "ROCK"（VOLCANO靜態障礙／PUZZLE關legacy ABYSS
 *    棋子）走 GomokuBoard 的 `obstacles` prop（岩石圖示，維持原行為）；
 *    "ENEMY_STONE"（DUEL關Boss活棋）改走 `stones` prop 的白子渲染（GomokuBoard
 *    原生雙色棋子），不可用岩石圖示——這正是本組件先前註解自陳的視覺缺口，
 *    此次改版補上。
 *  - `bossLastMove`：DUEL關Boss剛下的那一手，併入 `highlight` 陣列做短暫標記
 *    （複用既有 highlight 機制，不需要新的渲染路徑，§5.2）。
 *  - `allowOccupied` stays true unconditionally: GomokuBoard's own occupied
 *    guard would otherwise silently swallow clicks the page needs to see (to
 *    show "該位置已有棋子" / target-picking for PRECISION_SNIPE); the page's
 *    existing click handlers already re-validate stone/obstacle occupancy.
 *  - pendingCell / skillPreviewCells are shown via GomokuBoard's `highlight`
 *    (small per-cell markers) rather than the ultimate-skill `previewCells`
 *    3x2 dashed frame, which assumes a fixed box shape that doesn't fit
 *    PVE's varied single/pair-cell selections.
 *  - Known limitation: obstacle cells stay canvas-blocked even mid skill-flow
 *    (GomokuBoard blocks any `obstacles` cell before onPlace fires), so an
 *    axis-skill (橫劈/縱劈) anchor can't be picked ON an obstacle cell via a
 *    board click — a narrow edge case absent from this increment's e2e
 *    acceptance criteria; `onBlocked` still forwards to the same handler so
 *    the page's own toast messaging still fires for the plain-placement case.
 */
export function PveBoard({
  rows: _rows,
  cols: _cols,
  stones,
  obstacles,
  fieldType: _fieldType,
  pendingCell,
  skillPreviewCells = [],
  bossLastMove = null,
  bossSkillCells = [],
  horizontalDisabled = false,
  voidLineCells = [],
  interactive,
  skillFlowActive = false,
  onCellClick,
}: PveBoardProps) {
  const rockObstacles = obstacles.filter((o) => o.kind !== "ENEMY_STONE");
  const enemyStones = obstacles.filter((o) => o.kind === "ENEMY_STONE");
  const placedStones: PlacedStone[] = [
    ...stones.map((s) => ({ r: s.row, c: s.col, color: "black" as const })),
    ...enemyStones.map((s) => ({ r: s.row, c: s.col, color: "white" as const })),
  ];
  const highlight: [number, number][] = pendingCell
    ? [[pendingCell.row, pendingCell.col]]
    : skillPreviewCells.length > 0
      ? skillPreviewCells.map((c) => [c.row, c.col])
      : bossSkillCells.length > 0
        ? bossSkillCells.map((c) => [c.row, c.col])
        : bossLastMove
          ? [[bossLastMove.row, bossLastMove.col]]
          : [];

  return (
    <div data-testid="pve-board">
      {horizontalDisabled && (
        <p
          className="dim"
          style={{ fontSize: 12, marginBottom: 6 }}
          data-testid="pve-horizontal-disabled-banner"
        >
          本關橫向連五不算勝（雙方皆是）——把線往縱線、斜線經營。
        </p>
      )}
      <Board
        stones={placedStones}
        highlight={highlight}
        interactive={interactive}
        boardSize={11}
        obstacles={skillFlowActive ? [] : rockObstacles}
        voidCells={voidLineCells.map((c) => [c.row, c.col] as [number, number])}
        allowOccupied
        onPlace={onCellClick}
        onBlocked={onCellClick}
      />
      {/* e2e hook only — zero visual footprint; canvas pixels aren't directly
          assertable, so this mirrors the current stone list onto DOM
          attributes (same pattern as Board.tsx's "skill-anim" hook): `count`
          for "the initial board already has pre-placed stones" (documents/
          PVE-關卡重設計-2026-07-08.md §0/§6 acceptance) without needing to know
          which exact cells a given run's seed-picked Template landed on, and
          `cells` (JSON [row,col][]) for precise per-cell assertions (e.g.
          verifying a skill's push actually moved a specific stone). */}
      {/* e2e hook only — L3 void horizontal line cells (canvas pixels aren't
          assertable; same pattern as pve-stone-count below). */}
      <span
        data-testid="pve-void-line"
        data-count={voidLineCells.length}
        data-cells={JSON.stringify(voidLineCells.map((c) => [c.row, c.col]))}
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      />
      <span
        data-testid="pve-stone-count"
        data-count={placedStones.length}
        data-cells={JSON.stringify(placedStones.map((s) => [s.r, s.c]))}
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      />
    </div>
  );
}
