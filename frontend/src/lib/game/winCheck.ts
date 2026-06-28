import type { Color } from "@/lib/types/schemas";

export type Board = Record<string, "BLACK" | "WHITE">; // "r,c" -> color
export const key = (r: number, c: number) => `${r},${c}`;

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

/**
 * Detect an exact 5-in-a-row through (r,c) for `color`.
 * Returns the 5 winning cells (ordered), or null. Standard freestyle gomoku
 * win (>=5 counts as win; we return the first contiguous 5 cells).
 */
export function checkWin(
  board: Board,
  r: number,
  c: number,
  color: Color,
): { row: number; col: number }[] | null {
  for (const [dr, dc] of DIRS) {
    const line: { row: number; col: number }[] = [{ row: r, col: c }];
    // extend forward
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (board[key(nr, nc)] === color) line.push({ row: nr, col: nc });
      else break;
    }
    // extend backward
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i;
      const nc = c - dc * i;
      if (board[key(nr, nc)] === color) line.unshift({ row: nr, col: nc });
      else break;
    }
    if (line.length >= 5) {
      // take the contiguous window containing (r,c) — first 5 from the start
      return line.slice(0, 5);
    }
  }
  return null;
}
