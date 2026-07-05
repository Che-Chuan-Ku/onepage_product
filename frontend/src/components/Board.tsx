"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  GomokuBoard,
  type BeachState,
  type FieldCell,
  type FlashType,
  type PlacedStone,
  type RevealedCell,
  type SkillAnim,
} from "@/lib/game/GomokuBoard";

export interface BoardHandle {
  confirm: () => void;
  clearCursor: () => void;
  hasCursor: boolean;
  /** One-shot skill flash on the given cells (auto-clears after ~750ms). */
  flashCells: (cells: FieldCell[], type: FlashType) => void;
  /** One-shot skill-cast animation (direction-aware blade/box/arrow VFX). */
  playSkillAnim: (anim: SkillAnim, duration?: number) => void;
}

interface BoardProps {
  stones: PlacedStone[];
  opening?: PlacedStone[];
  lastMove?: [number, number] | null;
  highlight?: [number, number][];
  interactive?: boolean;
  /** Touch/confirm mode: place a preview then confirm explicitly. */
  requireConfirm?: boolean;
  spectating?: boolean;
  /** Board size (lines per side). Defaults to 15; 16 for beach mode. */
  boardSize?: number;
  /** Volcano obstacle cells — drawn as rocks, placement rejected. */
  obstacles?: FieldCell[];
  /** Beach field: ocean side + eroded rows. Omit/null for a plain board. */
  beach?: BeachState | null;
  /** Revealed hidden cells (dashed frame + emoji; post-game / replay). */
  revealedCells?: RevealedCell[];
  /** Ultimate-skill 3x2 preview frame; null/omit clears it. */
  previewCells?: FieldCell[] | null;
  /** Allow taps on occupied cells (PRECISION_SNIPE targets an enemy stone). */
  allowOccupied?: boolean;
  onPlace?: (r: number, c: number) => void;
  onCursorChange?: (hasCursor: boolean) => void;
  /** Nearest grid point under the pointer (ultimate-skill anchor stage). */
  onHover?: (r: number, c: number) => void;
  /** Fired when the user tries to play a blocked cell (page shows a toast). */
  onBlocked?: (r: number, c: number) => void;
  /** Extra placement veto beyond built-in obstacles. */
  isBlocked?: (r: number, c: number) => boolean;
}

/**
 * React wrapper around the Canvas GomokuBoard. Stones/highlight/opening are
 * driven from props (server-authoritative state); placement bubbles up via
 * onPlace. Exposes confirm()/clearCursor() through a ref for the Swap2 flow.
 */
export const Board = forwardRef<BoardHandle, BoardProps>(function Board(
  {
    stones,
    opening = [],
    lastMove = null,
    highlight = [],
    interactive = true,
    requireConfirm = false,
    spectating = false,
    boardSize = 15,
    obstacles,
    beach = null,
    revealedCells,
    previewCells = null,
    allowOccupied = false,
    onPlace,
    onCursorChange,
    onHover,
    onBlocked,
    isBlocked,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<GomokuBoard | null>(null);
  const [hasCursor, setHasCursor] = useState(false);
  // e2e-testability hook (機能性技能動畫驗收)：true while a SkillAnim is
  // playing on the canvas — canvas pixels aren't directly assertable, so this
  // mirrors the play/idle state onto a DOM attribute tests can read.
  const [skillAnimActive, setSkillAnimActive] = useState(false);

  // keep latest callbacks without re-instantiating the board
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;
  const isBlockedRef = useRef(isBlocked);
  isBlockedRef.current = isBlocked;

  useEffect(() => {
    if (!canvasRef.current) return;
    const b = new GomokuBoard(canvasRef.current, {
      interactive,
      requireConfirm,
      size: boardSize,
      onPlace: (r, c) => onPlaceRef.current?.(r, c),
      onCursorChange: (cur) => {
        const has = cur !== null;
        setHasCursor(has);
        onCursorChange?.(has);
      },
      onHover: (r, c) => onHoverRef.current?.(r, c),
      onBlocked: (r, c) => onBlockedRef.current?.(r, c),
      isBlocked: (r, c) => isBlockedRef.current?.(r, c) ?? false,
      onSkillAnimChange: (active) => setSkillAnimActive(active),
    });
    boardRef.current = b;
    // initial sync: when re-instantiating (size change) the sync effects
    // below do not re-run, so seed the fresh board with current props
    b.set(stones, { opening, last: lastMove, highlight });
    if (obstacles?.length) b.setObstacles(obstacles);
    if (beach) b.setBeach(beach.side, beach.erodedRows);
    if (revealedCells?.length) b.setRevealedCells(revealedCells);
    if (previewCells?.length) b.setPreviewCells(previewCells);
    return () => b.destroy();
    // re-instantiate only when the board size changes; other options are
    // synced via the effects below without rebuilding the canvas board
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize]);

  // sync stone/highlight/opening state
  useEffect(() => {
    boardRef.current?.set(stones, { opening, last: lastMove, highlight });
  }, [stones, opening, lastMove, highlight]);

  // sync interactive flags
  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.interactive = interactive;
      boardRef.current.requireConfirm = requireConfirm;
      boardRef.current.allowOccupied = allowOccupied;
    }
  }, [interactive, requireConfirm, allowOccupied]);

  // sync 真劍勝負 field state
  useEffect(() => {
    boardRef.current?.setObstacles(obstacles ?? []);
  }, [obstacles]);
  useEffect(() => {
    const b = boardRef.current;
    if (!b) return;
    if (beach) b.setBeach(beach.side, beach.erodedRows);
    else b.clearBeach();
  }, [beach]);
  useEffect(() => {
    boardRef.current?.setRevealedCells(revealedCells ?? []);
  }, [revealedCells]);
  useEffect(() => {
    boardRef.current?.setPreviewCells(previewCells ?? null);
  }, [previewCells]);

  useImperativeHandle(
    ref,
    () => ({
      confirm: () => boardRef.current?.confirm(),
      clearCursor: () => boardRef.current?.clearCursor(),
      hasCursor,
      flashCells: (cells: FieldCell[], type: FlashType) =>
        boardRef.current?.flashCells(cells, type),
      playSkillAnim: (anim: SkillAnim, duration?: number) =>
        boardRef.current?.playSkillAnim(anim, duration),
    }),
    [hasCursor],
  );

  return (
    <div className={`board-wrap${spectating ? " spectating" : ""}`}>
      <canvas className="board" ref={canvasRef} />
      {/* e2e hook only — zero visual footprint; asserts a skill cast actually
          triggered the canvas VFX (data-testid="skill-anim" 見驗收條件). */}
      <span
        data-testid="skill-anim"
        data-active={String(skillAnimActive)}
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      />
    </div>
  );
});
