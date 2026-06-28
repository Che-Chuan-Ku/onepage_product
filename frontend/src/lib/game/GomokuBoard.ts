/**
 * 15x15 Canvas board renderer — TypeScript port of prototype/assets/board.js.
 * Pure rendering + pointer/keyboard hit-testing; no app state. Shared by the
 * game / opening / replay screens via the <Board> React wrapper.
 */

export type StoneColor = "black" | "white";
export interface PlacedStone {
  r: number;
  c: number;
  color: StoneColor;
}

export interface BoardOptions {
  interactive?: boolean;
  requireConfirm?: boolean;
  onPlace?: (r: number, c: number) => void;
  /** Notifies React when the preview cursor changes (enables Confirm btn). */
  onCursorChange?: (cursor: [number, number] | null) => void;
}

const STARS: [number, number][] = [
  [3, 3],
  [3, 11],
  [11, 3],
  [11, 11],
  [7, 7],
];

export class GomokuBoard {
  readonly N = 15;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  stones: Record<string, StoneColor> = {};
  lastMove: [number, number] | null = null;
  highlight: [number, number][] = [];
  opening = new Set<string>();
  interactive: boolean;
  requireConfirm: boolean;
  onPlace: ((r: number, c: number) => void) | null;
  onCursorChange?: (cursor: [number, number] | null) => void;
  cursor: [number, number] | null = null;

  private dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  private px = 0;
  private pad = 0;
  private gap = 0;
  private kbCursor: [number, number] = [7, 7];
  private onResize = () => this.resize();
  // Listeners are removed via this controller's signal. We must NOT remove them
  // by cloning/replacing the canvas node — React owns the node via its ref, and
  // under StrictMode (mount→unmount→mount in dev) replacing it leaves the live
  // canvas without listeners and re-binds them to a detached node.
  private ac = new AbortController();

  constructor(canvas: HTMLCanvasElement, opts: BoardOptions = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.interactive = opts.interactive !== false;
    this.requireConfirm = opts.requireConfirm || false;
    this.onPlace = opts.onPlace || null;
    this.onCursorChange = opts.onCursorChange;
    this.bind();
    this.resize();
    window.addEventListener("resize", this.onResize, { signal: this.ac.signal });
  }

  destroy() {
    this.ac.abort(); // drops all listeners bound with this signal
  }

  private bind() {
    const signal = this.ac.signal;
    this.cv.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.interactive) return;
        const rc = this.hit(e);
        if (!rc) return;
        if (this.stones[rc.join(",")]) return; // occupied
        if (this.requireConfirm) {
          this.setCursor(rc);
        } else {
          this.place(rc);
        }
      },
      { signal },
    );
    this.cv.tabIndex = 0;
    this.cv.setAttribute("role", "grid");
    this.cv.setAttribute("aria-label", "15 乘 15 五子棋盤");
    this.cv.addEventListener("keydown", (e) => {
      if (!this.interactive) return;
      const m: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const d = m[e.key];
      if (d) {
        e.preventDefault();
        this.kbCursor = [
          Math.max(0, Math.min(14, this.kbCursor[0] + d[0])),
          Math.max(0, Math.min(14, this.kbCursor[1] + d[1])),
        ];
        this.setCursor([...this.kbCursor]);
      }
      if ((e.key === "Enter" || e.key === " ") && this.cursor) {
        e.preventDefault();
        this.confirm();
      }
    }, { signal });
  }

  private setCursor(rc: [number, number] | null) {
    this.cursor = rc;
    this.onCursorChange?.(rc);
    this.draw();
  }

  private place(rc: [number, number]) {
    this.onPlace?.(rc[0], rc[1]);
  }

  confirm() {
    if (this.cursor) {
      const rc = this.cursor;
      this.setCursor(null);
      this.place(rc);
    }
  }
  clearCursor() {
    this.setCursor(null);
  }

  set(
    stones: PlacedStone[],
    opts: { opening?: PlacedStone[]; last?: [number, number] | null; highlight?: [number, number][] } = {},
  ) {
    this.stones = {};
    // filter(Boolean): 防禦性 — 上游若不慎傳入 undefined（如 race / 邊界），
    // 不讓整個畫布 throw（reading 'r' of undefined）。
    (stones || []).filter(Boolean).forEach((s) => (this.stones[`${s.r},${s.c}`] = s.color));
    this.opening = new Set();
    if (opts.opening) opts.opening.filter(Boolean).forEach((s) => this.opening.add(`${s.r},${s.c}`));
    if ("last" in opts) this.lastMove = opts.last ?? null;
    if ("highlight" in opts) this.highlight = opts.highlight || [];
    this.draw();
  }
  add(r: number, c: number, color: StoneColor, isOpening = false) {
    this.stones[`${r},${c}`] = color;
    this.lastMove = [r, c];
    if (isOpening) this.opening.add(`${r},${c}`);
    this.draw();
  }
  remove(r: number, c: number) {
    delete this.stones[`${r},${c}`];
    this.opening.delete(`${r},${c}`);
    if (this.lastMove && this.lastMove[0] === r && this.lastMove[1] === c) this.lastMove = null;
    this.draw();
  }
  setHighlight(line: [number, number][]) {
    this.highlight = line || [];
    this.draw();
  }

  resize() {
    const size = this.cv.clientWidth;
    if (!size) return;
    this.cv.width = size * this.dpr;
    this.cv.height = size * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.px = size;
    this.pad = size * 0.045;
    this.gap = (size - 2 * this.pad) / (this.N - 1);
    this.draw();
  }
  private xy(r: number, c: number): [number, number] {
    return [this.pad + c * this.gap, this.pad + r * this.gap];
  }
  private hit(e: PointerEvent): [number, number] | null {
    const rect = this.cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.round((x - this.pad) / this.gap);
    const r = Math.round((y - this.pad) / this.gap);
    if (r < 0 || r >= this.N || c < 0 || c >= this.N) return null;
    return [r, c];
  }

  draw() {
    const ctx = this.ctx;
    const g = this.gap;
    const p = this.pad;
    const S = this.px;
    if (!S) return;
    ctx.clearRect(0, 0, S, S);
    // grid
    ctx.strokeStyle = "#6b4f30";
    ctx.lineWidth = 1;
    for (let i = 0; i < this.N; i++) {
      ctx.beginPath();
      ctx.moveTo(p + i * g, p);
      ctx.lineTo(p + i * g, S - p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, p + i * g);
      ctx.lineTo(S - p, p + i * g);
      ctx.stroke();
    }
    // star points
    ctx.fillStyle = "#5a3f23";
    STARS.forEach(([r, c]) => {
      const [x, y] = this.xy(r, c);
      ctx.beginPath();
      ctx.arc(x, y, g * 0.1, 0, 7);
      ctx.fill();
    });
    // stones
    const rad = g * 0.42;
    for (const k in this.stones) {
      const [r, c] = k.split(",").map(Number);
      const [x, y] = this.xy(r, c);
      const col = this.stones[k];
      const grad = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
      if (col === "black") {
        grad.addColorStop(0, "#5a5a62");
        grad.addColorStop(1, "#0d0d10");
      } else {
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(1, "#cfc8ba");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (this.opening.has(k)) {
        ctx.strokeStyle = "rgba(224,164,88,.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, rad + 3, 0, 7);
        ctx.stroke();
      }
    }
    // last move marker
    if (this.lastMove) {
      const [x, y] = this.xy(...this.lastMove);
      ctx.strokeStyle = "#e0573e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.35, 0, 7);
      ctx.stroke();
    }
    // win highlight
    if (this.highlight.length) {
      ctx.save();
      ctx.shadowColor = "#ffd34d";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "#ffd34d";
      ctx.lineWidth = 3;
      this.highlight.forEach(([r, c]) => {
        const [x, y] = this.xy(r, c);
        ctx.beginPath();
        ctx.arc(x, y, rad + 2, 0, 7);
        ctx.stroke();
      });
      if (this.highlight.length >= 2) {
        const a = this.xy(...this.highlight[0]);
        const b = this.xy(...this.highlight[this.highlight.length - 1]);
        ctx.beginPath();
        ctx.moveTo(...a);
        ctx.lineTo(...b);
        ctx.stroke();
      }
      ctx.restore();
    }
    // cursor preview
    if (this.cursor) {
      const [x, y] = this.xy(...this.cursor);
      ctx.strokeStyle = "rgba(224,164,88,.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 7);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
