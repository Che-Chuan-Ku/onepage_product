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

/* ── 真劍勝負 (duel) field-rendering types ── */
/** A single board cell, addressed by grid row/col (0-based). */
export interface FieldCell {
  row: number;
  col: number;
}
/** Which side of the beach board the ocean occupies. */
export type BeachSide = "top" | "bottom" | "left" | "right";
/** Beach field state: ocean side + rows already eroded by the tide. */
export interface BeachState {
  side: BeachSide;
  erodedRows: number;
}
/** Kind of a revealed hidden cell. */
export type RevealKind = "ERUPTION" | "TIDE";
export interface RevealedCell extends FieldCell {
  kind: RevealKind;
}
/** One-shot flash effect flavor (skill feedback). */
export type FlashType = "burn" | "tide" | "wave" | "slash";

export interface BoardOptions {
  interactive?: boolean;
  requireConfirm?: boolean;
  onPlace?: (r: number, c: number) => void;
  /** Notifies React when the preview cursor changes (enables Confirm btn). */
  onCursorChange?: (cursor: [number, number] | null) => void;
  /** Board size (lines per side). Defaults to 15; 16 is used by beach mode. */
  size?: number;
  /**
   * Extra placement veto beyond the built-in obstacle check. Return true to
   * reject the cell (cursor/confirm flow refuses, onBlocked fires).
   */
  isBlocked?: (r: number, c: number) => boolean;
  /** Fired when the user tries to play a blocked cell (obstacle or vetoed). */
  onBlocked?: (r: number, c: number) => void;
  /**
   * Reports the nearest grid point under the pointer on pointermove
   * (deduped per cell). Used by the ultimate-skill anchor preview.
   */
  onHover?: (r: number, c: number) => void;
}

/**
 * Star points for an n×n board: four quarter points 3 lines in from each
 * edge, plus a center point when n is odd (even boards have no center line).
 */
function starPoints(n: number): [number, number][] {
  const far = n - 4;
  const pts: [number, number][] = [
    [3, 3],
    [3, far],
    [far, 3],
    [far, far],
  ];
  if (n % 2 === 1) {
    const mid = (n - 1) / 2;
    pts.push([mid, mid]);
  }
  return pts;
}

export class GomokuBoard {
  readonly N: number;
  private readonly stars: [number, number][];
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  stones: Record<string, StoneColor> = {};
  lastMove: [number, number] | null = null;
  highlight: [number, number][] = [];
  opening = new Set<string>();
  interactive: boolean;
  requireConfirm: boolean;
  /** Allow taps on occupied cells (PRECISION_SNIPE targets an enemy stone). */
  allowOccupied = false;
  onPlace: ((r: number, c: number) => void) | null;
  onCursorChange?: (cursor: [number, number] | null) => void;
  cursor: [number, number] | null = null;
  onBlocked: ((r: number, c: number) => void) | null;
  onHover: ((r: number, c: number) => void) | null;
  private isBlockedOpt: ((r: number, c: number) => boolean) | null;
  // 真劍勝負 field state (all default to "off" → zero visual change)
  private obstacles = new Set<string>();
  private beach: BeachState | null = null;
  private revealed: RevealedCell[] = [];
  private previewCells: FieldCell[] = [];
  private fx: { r: number; c: number; type: FlashType; until: number }[] = [];
  private fxLoopRunning = false;
  private lastHover: [number, number] | null = null;

  private dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  private px = 0;
  private pad = 0;
  private gap = 0;
  private kbCursor: [number, number];
  private onResize = () => this.resize();
  // Listeners are removed via this controller's signal. We must NOT remove them
  // by cloning/replacing the canvas node — React owns the node via its ref, and
  // under StrictMode (mount→unmount→mount in dev) replacing it leaves the live
  // canvas without listeners and re-binds them to a detached node.
  private ac = new AbortController();

  constructor(canvas: HTMLCanvasElement, opts: BoardOptions = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.N = opts.size ?? 15;
    this.stars = starPoints(this.N);
    const mid = Math.floor((this.N - 1) / 2);
    this.kbCursor = [mid, mid];
    this.interactive = opts.interactive !== false;
    this.requireConfirm = opts.requireConfirm || false;
    this.onPlace = opts.onPlace || null;
    this.onCursorChange = opts.onCursorChange;
    this.onBlocked = opts.onBlocked || null;
    this.onHover = opts.onHover || null;
    this.isBlockedOpt = opts.isBlocked || null;
    this.bind();
    this.resize();
    window.addEventListener("resize", this.onResize, { signal: this.ac.signal });
  }

  destroy() {
    this.ac.abort(); // drops all listeners bound with this signal
    this.fx = []; // lets any pending flash rAF loop exit on its next frame
  }

  private bind() {
    const signal = this.ac.signal;
    this.cv.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.interactive) return;
        const rc = this.hit(e);
        if (!rc) return;
        if (!this.allowOccupied && this.stones[rc.join(",")]) return; // occupied
        // blocked cells (obstacles / vetoed) never become a cursor target
        if (this.blocked(rc[0], rc[1])) {
          this.onBlocked?.(rc[0], rc[1]);
          return;
        }
        if (this.requireConfirm) {
          this.setCursor(rc);
        } else {
          this.place(rc);
        }
      },
      { signal },
    );
    // hover reporting for the ultimate-skill anchor preview (deduped per cell)
    this.cv.addEventListener(
      "pointermove",
      (e) => {
        if (!this.onHover) return;
        const rc = this.hit(e);
        if (!rc) return;
        if (this.lastHover && this.lastHover[0] === rc[0] && this.lastHover[1] === rc[1]) return;
        this.lastHover = rc;
        this.onHover(rc[0], rc[1]);
      },
      { signal },
    );
    this.cv.tabIndex = 0;
    this.cv.setAttribute("role", "grid");
    this.cv.setAttribute("aria-label", `${this.N} 乘 ${this.N} 五子棋盤`);
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
          Math.max(0, Math.min(this.N - 1, this.kbCursor[0] + d[0])),
          Math.max(0, Math.min(this.N - 1, this.kbCursor[1] + d[1])),
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
    // Single gate for both direct taps and the keyboard cursor→confirm flow;
    // confirm()/setCursor() themselves stay untouched (cursor contract).
    if (this.blocked(rc[0], rc[1])) {
      this.onBlocked?.(rc[0], rc[1]);
      return;
    }
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

  /* ── 真劍勝負 field-rendering API ── */

  /** Volcano obstacle cells: drawn as dark rocks, always unplayable. */
  setObstacles(cells: FieldCell[]) {
    this.obstacles = new Set((cells || []).filter(Boolean).map((c) => `${c.row},${c.col}`));
    this.draw();
  }
  isObstacle(r: number, c: number): boolean {
    return this.obstacles.has(`${r},${c}`);
  }
  private blocked(r: number, c: number): boolean {
    return this.isObstacle(r, c) || (this.isBlockedOpt?.(r, c) ?? false);
  }

  /**
   * Beach field: the half board on `side` gets an ocean tint, the rest a sand
   * tint. `erodedRows` extra rows (advancing from the ocean side inward) are
   * painted as ocean too. Ocean cells stay playable.
   */
  setBeach(side: BeachSide, erodedRows: number) {
    this.beach = { side, erodedRows: Math.max(0, erodedRows) };
    this.draw();
  }
  /** Removes the beach field (back to the plain board). */
  clearBeach() {
    this.beach = null;
    this.draw();
  }
  /** True when (r,c) is currently ocean (incl. eroded rows). */
  isOcean(r: number, c: number): boolean {
    if (!this.beach) return false;
    const half = Math.floor(this.N / 2);
    // cap erosion so at least one sand row survives (mirrors prototype board.js)
    const bound = half + Math.min(this.beach.erodedRows, half - 1);
    switch (this.beach.side) {
      case "top":
        return r < bound;
      case "bottom":
        return r >= this.N - bound;
      case "left":
        return c < bound;
      case "right":
        return c >= this.N - bound;
    }
  }

  /** Batch-set revealed hidden cells (dashed frame + emoji, post-game/replay). */
  setRevealedCells(cells: RevealedCell[]) {
    this.revealed = (cells || []).filter(Boolean);
    this.draw();
  }

  /** Ultimate-skill 3x2 preview frame (dashed yellow); null clears it. */
  setPreviewCells(cells: FieldCell[] | null) {
    this.previewCells = cells || [];
    this.draw();
  }

  /**
   * One-shot flash on the given cells; auto-clears after ~750ms and redraws.
   * burn=orange-red, tide=blue, wave=teal, slash=white/silver.
   */
  flashCells(cells: FieldCell[], type: FlashType) {
    const until = Date.now() + 750;
    (cells || []).filter(Boolean).forEach((c) => this.fx.push({ r: c.row, c: c.col, type, until }));
    this.draw();
    this.runFxLoop();
  }
  private runFxLoop() {
    if (this.fxLoopRunning || !this.fx.length) return;
    this.fxLoopRunning = true;
    const loop = () => {
      this.fx = this.fx.filter((f) => f.until > Date.now());
      this.draw();
      if (this.fx.length) requestAnimationFrame(loop);
      else this.fxLoopRunning = false;
    };
    requestAnimationFrame(loop);
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
    // beach field background — painted under the grid lines
    if (this.beach) {
      const h = g / 2;
      for (let r = 0; r < this.N; r++) {
        for (let c = 0; c < this.N; c++) {
          const [x, y] = this.xy(r, c);
          ctx.fillStyle = this.isOcean(r, c)
            ? "rgba(47,106,138,.55)" // ocean (prototype board.js)
            : "rgba(238,214,160,.5)"; // sand
          ctx.fillRect(x - h, y - h, g, g);
        }
      }
    }
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
    this.stars.forEach(([r, c]) => {
      const [x, y] = this.xy(r, c);
      ctx.beginPath();
      ctx.arc(x, y, g * 0.1, 0, 7);
      ctx.fill();
    });
    // volcano obstacles — visibly unplayable lava-cone cells (red/orange
    // volcano style: hot-rock halo + gradient cone body + molten crater glow,
    // deliberately warm-toned to contrast the board's amber wood grain).
    if (this.obstacles.size) {
      ctx.save();
      this.obstacles.forEach((k) => {
        const [r, c] = k.split(",").map(Number);
        const [x, y] = this.xy(r, c);
        const R = g * 0.42;
        // outer halo — hot rock radiating heat
        const halo = ctx.createRadialGradient(x, y, 0, x, y, R * 1.7);
        halo.addColorStop(0, "rgba(255,90,30,.35)");
        halo.addColorStop(1, "rgba(255,90,30,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, R * 1.7, 0, 7);
        ctx.fill();
        // cone body — dark maroon base rising to a bright ember peak
        const body = ctx.createLinearGradient(x, y + R, x, y - R);
        body.addColorStop(0, "#3a0e08");
        body.addColorStop(0.55, "#8a2a10");
        body.addColorStop(1, "#ff7a28");
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x, y - R);
        ctx.lineTo(x + R * 0.85, y + R * 0.8);
        ctx.quadraticCurveTo(x, y + R * 1.05, x - R * 0.85, y + R * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#2a0805";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // molten crater glow at the peak
        const core = ctx.createRadialGradient(x, y - R * 0.55, 0, x, y - R * 0.55, R * 0.42);
        core.addColorStop(0, "rgba(255,214,120,.95)");
        core.addColorStop(1, "rgba(255,110,30,0)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(x, y - R * 0.55, R * 0.42, 0, 7);
        ctx.fill();
      });
      ctx.restore();
    }
    // revealed hidden cells — dashed frame + emoji (post-game / replay)
    if (this.revealed.length) {
      ctx.save();
      ctx.font = `${Math.round(g * 0.5)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.revealed.forEach(({ row, col, kind }) => {
        const [x, y] = this.xy(row, col);
        // eruption reveal gets a brighter orange-red glow (coordinates with
        // the volcano obstacle's lava-cone palette); tide reveal unchanged.
        if (kind === "ERUPTION") {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, g * 0.62);
          glow.addColorStop(0, "rgba(255,150,60,.6)");
          glow.addColorStop(1, "rgba(255,90,20,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, g * 0.62, 0, 7);
          ctx.fill();
        }
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = kind === "ERUPTION" ? "#ff7a28" : "#5ac8f0";
        ctx.beginPath();
        ctx.arc(x, y, g * 0.46, 0, 7);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(kind === "ERUPTION" ? "🌋" : "🌊", x, y + 1);
      });
      ctx.restore();
    }
    // transient flash effects (flashCells) — radial glow + optional emoji
    if (this.fx.length) {
      const fxColor: Record<FlashType, string> = {
        burn: "255,110,40",
        tide: "80,190,230",
        wave: "90,220,205",
        slash: "235,235,245",
      };
      const fxEmoji: Partial<Record<FlashType, string>> = { burn: "🔥", tide: "🌊", wave: "🌊" };
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.fx.forEach(({ r, c, type }) => {
        const [x, y] = this.xy(r, c);
        const rgb = fxColor[type];
        const glow = ctx.createRadialGradient(x, y, 0, x, y, g * 1.4);
        glow.addColorStop(0, `rgba(${rgb},.7)`);
        glow.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, g * 1.4, 0, 7);
        ctx.fill();
        const emoji = fxEmoji[type];
        if (emoji) {
          ctx.font = `${Math.round(g * 0.7)}px sans-serif`;
          ctx.fillText(emoji, x, y);
        }
      });
      ctx.restore();
    }
    // ultimate-skill 3x2 preview frame — dashed yellow (prototype board.js)
    if (this.previewCells.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,211,77,.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      this.previewCells.forEach(({ row, col }) => {
        const [x, y] = this.xy(row, col);
        ctx.strokeRect(x - g / 2 + 3, y - g / 2 + 3, g - 6, g - 6);
      });
      ctx.restore();
    }
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
    // cursor preview — must stay legible on small (mobile) boards where the
    // finger covers the target cell: row/col guide lines locate the cell even
    // when occluded, and the filled ghost + glow ring beat a thin dashed circle.
    if (this.cursor) {
      const [x, y] = this.xy(...this.cursor);
      ctx.save();
      // row/column guide lines (saturated orange so they read against both
      // the #d9a86c board and the #6b4f30 grid lines)
      ctx.strokeStyle = "rgba(255,140,0,.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p, y);
      ctx.lineTo(S - p, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, p);
      ctx.lineTo(x, S - p);
      ctx.stroke();
      // ghost stone fill — bright orange pops against the mid-amber board
      ctx.fillStyle = "rgba(255,178,64,.6)";
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 7);
      ctx.fill();
      // dark ring + warm glow: contrast in both directions on wood tones
      ctx.shadowColor = "rgba(255,194,94,.95)";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#9a5d0f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, rad + 2, 0, 7);
      ctx.stroke();
      ctx.restore();
    }
  }
}
