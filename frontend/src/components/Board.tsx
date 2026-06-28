"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  GomokuBoard,
  type PlacedStone,
} from "@/lib/game/GomokuBoard";

export interface BoardHandle {
  confirm: () => void;
  clearCursor: () => void;
  hasCursor: boolean;
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
  onPlace?: (r: number, c: number) => void;
  onCursorChange?: (hasCursor: boolean) => void;
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
    onPlace,
    onCursorChange,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<GomokuBoard | null>(null);
  const [hasCursor, setHasCursor] = useState(false);

  // keep latest onPlace without re-instantiating the board
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;

  useEffect(() => {
    if (!canvasRef.current) return;
    const b = new GomokuBoard(canvasRef.current, {
      interactive,
      requireConfirm,
      onPlace: (r, c) => onPlaceRef.current?.(r, c),
      onCursorChange: (cur) => {
        const has = cur !== null;
        setHasCursor(has);
        onCursorChange?.(has);
      },
    });
    boardRef.current = b;
    return () => b.destroy();
    // instantiate once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync stone/highlight/opening state
  useEffect(() => {
    boardRef.current?.set(stones, { opening, last: lastMove, highlight });
  }, [stones, opening, lastMove, highlight]);

  // sync interactive flags
  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.interactive = interactive;
      boardRef.current.requireConfirm = requireConfirm;
    }
  }, [interactive, requireConfirm]);

  useImperativeHandle(
    ref,
    () => ({
      confirm: () => boardRef.current?.confirm(),
      clearCursor: () => boardRef.current?.clearCursor(),
      hasCursor,
    }),
    [hasCursor],
  );

  return (
    <div className={`board-wrap${spectating ? " spectating" : ""}`}>
      <canvas className="board" ref={canvasRef} />
    </div>
  );
});
