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

/**
 * 真劍勝負技能施放動畫（機能性，辨識度優先於華麗）— distinct from the
 * simpler radial `flashCells` above (which stays for the plain per-cell
 * burn/tide/wave/slash glow). One `SkillAnim` = one skill cast; auto-clears
 * after `duration` ms (0.5–1s per spec) and never touches pointer/keyboard
 * handling — it is a purely additive, temporary draw pass appended at the
 * end of `draw()`.
 *  - slash: direction-aware sweeping blade across the pushed cells (橫劈/縱劈).
 *  - reversal: 3×2 box highlight + per-cell coin-flip disc (天地反轉).
 *  - pioneer: 3×2 box highlight + per-cell disperse burst (開拓之星).
 *  - snipe/scatter: arrow(s) flying in from outside the board + impact flash
 *    (精準狙擊／散射).
 */
export type SkillAnim =
  | { kind: "slash"; axis: "row" | "col"; origin: FieldCell; cells: FieldCell[] }
  | { kind: "reversal"; box: FieldCell[]; flipCells: FieldCell[] }
  | { kind: "pioneer"; box: FieldCell[]; clearCells: FieldCell[] }
  | { kind: "snipe"; target: FieldCell }
  | { kind: "scatter"; targets: FieldCell[] };

export interface BoardOptions {
  interactive?: boolean;
  requireConfirm?: boolean;
  onPlace?: (r: number, c: number) => void;
  /** Notifies React when the preview cursor changes (enables Confirm btn). */
  onCursorChange?: (cursor: [number, number] | null) => void;
  /** Notifies React when a skill-cast animation starts/finishes (e2e hook). */
  onSkillAnimChange?: (active: boolean) => void;
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

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

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
  // 真劍勝負技能施放動畫 (SkillAnim) — separate one-shot queue from `fx` above.
  private skillAnims: (SkillAnim & { start: number; duration: number })[] = [];
  private skillLoopRunning = false;
  private onSkillAnimChange?: (active: boolean) => void;

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
    this.onSkillAnimChange = opts.onSkillAnimChange;
    this.bind();
    this.resize();
    window.addEventListener("resize", this.onResize, { signal: this.ac.signal });
  }

  destroy() {
    this.ac.abort(); // drops all listeners bound with this signal
    this.fx = []; // lets any pending flash rAF loop exit on its next frame
    this.skillAnims = []; // ditto for any pending skill-anim rAF loop
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

  /**
   * One-shot skill-cast animation (see `SkillAnim` doc). Non-blocking: pure
   * canvas draw, no effect on pointer/keyboard handling. `duration` defaults
   * to 700ms (inside the required 0.5–1s window).
   */
  playSkillAnim(anim: SkillAnim, duration = 700) {
    const wasEmpty = this.skillAnims.length === 0;
    this.skillAnims.push({ ...anim, start: now(), duration });
    if (wasEmpty) this.onSkillAnimChange?.(true);
    this.draw();
    this.runSkillLoop();
  }
  private runSkillLoop() {
    if (this.skillLoopRunning || !this.skillAnims.length) return;
    this.skillLoopRunning = true;
    const loop = () => {
      const t = now();
      this.skillAnims = this.skillAnims.filter((a) => t - a.start < a.duration);
      this.draw();
      if (this.skillAnims.length) {
        requestAnimationFrame(loop);
      } else {
        this.skillLoopRunning = false;
        this.onSkillAnimChange?.(false);
      }
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
    // 真劍勝負技能施放動畫 (SkillAnim) — drawn last so it reads clearly on top
    // of stones/cursor; purely additive to the render pipeline above.
    this.drawSkillAnims();
  }

  // ── 真劍勝負技能施放動畫 (SkillAnim) rendering ──────────────────
  private drawSkillAnims() {
    if (!this.skillAnims.length) return;
    const ctx = this.ctx;
    const t = now();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    for (const a of this.skillAnims) {
      const progress = Math.max(0, Math.min(1, (t - a.start) / a.duration));
      ctx.save();
      if (a.kind === "slash") this.drawSlashAnim(a, progress, ease(progress));
      else if (a.kind === "reversal") this.drawBoxFlipAnim(a, progress);
      else if (a.kind === "pioneer") this.drawBoxDisperseAnim(a, progress, ease(progress));
      else if (a.kind === "snipe") this.drawArrowAnim(a.target, progress);
      else if (a.kind === "scatter") a.targets.forEach((tg, i) => this.drawArrowAnim(tg, progress, i));
      ctx.restore();
    }
  }

  /** 橫劈/縱劈：a horizontal (or vertical) light blade sweeps along the push
   * axis through the pushed cells, plus a brief burst as it passes each one. */
  private drawSlashAnim(
    a: Extract<SkillAnim, { kind: "slash" }>,
    progress: number,
    eased: number,
  ) {
    const ctx = this.ctx;
    const g = this.gap;
    const originVal = a.axis === "row" ? a.origin.row : a.origin.col;
    const perpVal = a.axis === "row" ? a.origin.col : a.origin.row;
    const travelVals = a.cells.map((c) => (a.axis === "row" ? c.row : c.col));
    const farVal = travelVals.length ? travelVals[travelVals.length - 1] : originVal;
    const dirSign = Math.sign(farVal - originVal) || 1;
    const endVal = farVal + dirSign * 0.5; // slight follow-through past the last cell
    const span = endVal - originVal || 1;
    const curVal = originVal + span * eased;
    const toXY = (v: number): [number, number] =>
      a.axis === "row" ? this.xy(v, perpVal) : this.xy(perpVal, v);

    // fading trail behind the blade head
    const steps = 5;
    for (let i = steps; i >= 1; i--) {
      const v = curVal - dirSign * (i / steps) * g * 0.9;
      const [x, y] = toXY(v);
      const alpha = (1 - i / steps) * 0.45;
      ctx.fillStyle = `rgba(235,235,245,${alpha})`;
      if (a.axis === "row") ctx.fillRect(x - g * 0.6, y - g * 0.05, g * 1.2, g * 0.1);
      else ctx.fillRect(x - g * 0.05, y - g * 0.6, g * 0.1, g * 1.2);
    }
    // bright blade head
    const [hx, hy] = toXY(curVal);
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,.9)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(245,245,255,.95)";
    if (a.axis === "row") ctx.fillRect(hx - g * 0.68, hy - g * 0.09, g * 1.36, g * 0.18);
    else ctx.fillRect(hx - g * 0.09, hy - g * 0.68, g * 0.18, g * 1.36);
    ctx.restore();
    // burst on each pushed cell as the blade passes it
    a.cells.forEach((cell) => {
      const cv = a.axis === "row" ? cell.row : cell.col;
      const threshold = (cv - originVal) / span;
      const local = progress - threshold;
      const win = 0.3;
      if (local >= 0 && local <= win) {
        const bt = local / win;
        const [x, y] = this.xy(cell.row, cell.col);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${1 - bt})`;
        ctx.lineWidth = 2;
        ctx.arc(x, y, g * (0.25 + 0.55 * bt), 0, 7);
        ctx.stroke();
      }
    });
  }

  /** Shared 3×2 box outline (bounding rect of the given cells), used by both
   * 天地反轉 and 開拓之星 — `alpha`/`color`/dash configurable per caller. */
  private drawAnimBox(cells: FieldCell[], color: string, dash: number[] = []) {
    if (!cells.length) return;
    const ctx = this.ctx;
    const g = this.gap;
    const rows = cells.map((c) => c.row);
    const cols = cells.map((c) => c.col);
    const r0 = Math.min(...rows);
    const r1 = Math.max(...rows);
    const c0 = Math.min(...cols);
    const c1 = Math.max(...cols);
    const [x0, y0] = this.xy(r0, c0);
    const [x1, y1] = this.xy(r1, c1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash(dash);
    ctx.strokeRect(x0 - g / 2 + 2, y0 - g / 2 + 2, x1 - x0 + g - 4, y1 - y0 + g - 4);
    ctx.restore();
  }

  /** 天地反轉：3×2 box pulse + per-cell coin-flip disc (black⇄white shimmer). */
  private drawBoxFlipAnim(a: Extract<SkillAnim, { kind: "reversal" }>, progress: number) {
    const ctx = this.ctx;
    const g = this.gap;
    const pulse = Math.sin(Math.min(progress, 1) * Math.PI);
    this.drawAnimBox(a.box, `rgba(255,211,77,${0.35 + 0.5 * pulse})`);
    const flipScale = Math.max(0.06, Math.abs(Math.cos(Math.min(progress, 1) * Math.PI)));
    const rad = g * 0.42;
    a.flipCells.forEach((cell) => {
      const [x, y] = this.xy(cell.row, cell.col);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, flipScale);
      const grad = ctx.createLinearGradient(-rad, 0, rad, 0);
      grad.addColorStop(0, "rgba(255,255,255,.95)");
      grad.addColorStop(0.5, "rgba(255,225,150,.95)");
      grad.addColorStop(1, "rgba(20,20,25,.95)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, 7);
      ctx.fill();
      ctx.restore();
    });
  }

  /** 開拓之星：3×2 box pulse (dashed, teal) + per-cell disperse burst. */
  private drawBoxDisperseAnim(
    a: Extract<SkillAnim, { kind: "pioneer" }>,
    progress: number,
    eased: number,
  ) {
    const ctx = this.ctx;
    const g = this.gap;
    const pulse = Math.sin(Math.min(progress, 1) * Math.PI);
    this.drawAnimBox(a.box, `rgba(120,220,190,${0.4 + 0.4 * pulse})`, [6, 4]);
    const alpha = Math.max(0, 1 - progress * 1.1);
    a.clearCells.forEach((cell) => {
      const [x, y] = this.xy(cell.row, cell.col);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(150,240,210,.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, g * 0.42 * (1 + eased * 0.6), 0, 7);
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const ang = (Math.PI / 2) * k + Math.PI / 4;
        const dist = g * 0.6 * eased;
        ctx.beginPath();
        ctx.fillStyle = "rgba(150,240,210,.9)";
        ctx.arc(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, g * 0.06, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  /** 精準狙擊/散射：an arrow flies in from outside the board toward `target`
   * (direction derived from the board centre so it always reads as "from off
   * screen"), then a brief impact flash. `idx` (scatter's 2nd arrow) rotates
   * the incoming angle so both shots read as visually distinct. */
  private drawArrowAnim(target: FieldCell, progress: number, idx = 0) {
    const ctx = this.ctx;
    const g = this.gap;
    const S = this.px;
    const [tx, ty] = this.xy(target.row, target.col);
    const cx = S / 2;
    const cy = S / 2;
    let vx = tx - cx || (idx === 1 ? 1 : -1);
    let vy = ty - cy || -1;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len;
    vy /= len;
    if (idx === 1) {
      const rot = 0.6; // ~34°, so scatter's 2 arrows read as distinct
      const nx = vx * Math.cos(rot) - vy * Math.sin(rot);
      const ny = vx * Math.sin(rot) + vy * Math.cos(rot);
      vx = nx;
      vy = ny;
    }
    const dist = S * 0.9; // guaranteed outside the visible board
    const sx = tx + vx * dist;
    const sy = ty + vy * dist;
    const flightEnd = 0.75;
    if (progress < flightEnd) {
      const t = progress / flightEnd;
      const et = 1 - Math.pow(1 - t, 2);
      const x = sx + (tx - sx) * et;
      const y = sy + (ty - sy) * et;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(ty - sy, tx - sx));
      ctx.fillStyle = "#ffd34d";
      ctx.strokeStyle = "rgba(0,0,0,.4)";
      ctx.beginPath();
      ctx.moveTo(g * 0.5, 0);
      ctx.lineTo(-g * 0.15, -g * 0.14);
      ctx.lineTo(-g * 0.15, g * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,211,77,.8)";
      ctx.lineWidth = g * 0.06;
      ctx.beginPath();
      ctx.moveTo(-g * 0.15, 0);
      ctx.lineTo(-g * 0.9, 0);
      ctx.stroke();
      ctx.restore();
    } else {
      const it = (progress - flightEnd) / (1 - flightEnd);
      ctx.save();
      ctx.globalAlpha = 1 - it;
      ctx.strokeStyle = "#ffd34d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx, ty, g * (0.3 + 0.9 * it), 0, 7);
      ctx.stroke();
      ctx.restore();
    }
  }
}
