"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Board, type BoardHandle } from "@/components/Board";
import { Modal } from "@/components/Modal";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { gameService, roomService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import { USE_MOCKS } from "@/lib/api/config";
import type {
  Cell,
  ClassType,
  Color,
  FieldType,
  GameStateResponse,
  MoveCreateRequest,
  SkillDirection,
  SkillEvent,
  SkillType,
} from "@/lib/types/schemas";
import type {
  FieldCell,
  PlacedStone,
  RevealedCell,
  ScatterGuide,
  SkillAnim,
  SlideMove,
  StoneColor,
} from "@/lib/game/GomokuBoard";
import { DIR_DELTA, isUltimate, ultimateRect, wavePushDirection, type OceanSide } from "@/lib/game/duel";
import {
  applyDuelEvents,
  beachSideFor,
  cellKey,
  duelFieldMeta,
  duelSnapshots,
  inferSkillCast,
  stonesFromMap,
  type StoneMap,
} from "@/lib/game/duelClient";
import { StompClient, type ConnState } from "@/lib/stomp/client";
import { channels } from "@/lib/stomp/channels";
import { useSession } from "@/lib/store/session";
import { toast } from "@/lib/store/toast";

const lc = (c: Color): StoneColor => (c === "BLACK" ? "black" : "white");
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ── 真劍勝負 skill metadata (需求 #36 #42 #43, Q10) ──────────────
// `desc` is the definitive rules text (技能說明需求) — shown verbatim via the
// desktop hover tooltip / mobile ⓘ popover on each skill button; do not
// paraphrase, this copy is the agreed-upon spec wording.
const SKILL_INFO: Record<SkillType, { name: string; ico: string; desc: string }> = {
  HORIZONTAL_SLASH: {
    name: "橫劈",
    ico: "⚔️",
    desc: "落子時發動。選擇上或下，將緊鄰該方向的橫排3格棋子往該方向推1格（連鎖推擠、出界移除、遇障礙擋停）。一場限一次。",
  },
  VERTICAL_SLASH: {
    name: "縱劈",
    ico: "🗡️",
    // 規則變更（2026-07-07 裁決）：縱劈改為一格寬。
    desc: "落子時發動。選擇左或右，將緊鄰該方向的一格棋子往前推1格（連鎖推擠、出界移除、遇障礙擋停）。一場限一次。",
  },
  HEAVEN_EARTH_REVERSAL: {
    name: "天地反轉（大絕）",
    ico: "🌗",
    desc: "取代本回合落子。選擇空格錨點與方向，3寬×2深共6格內雙方棋子顏色互換。一場限一次。",
  },
  PRECISION_SNIPE: {
    name: "精準狙擊",
    ico: "🎯",
    desc: "本手改為替換場上任一顆敵方棋子為己方顏色。一場限一次。",
  },
  SCATTER_SHOT: {
    name: "散射",
    ico: "🏹",
    desc: "本手同時下2子於空格，兩子不得在彼此九宮格範圍內。一場限一次。",
  },
  PIONEER_STAR: {
    name: "開拓之星（大絕）",
    ico: "💫",
    desc: "取代本回合落子。選擇空格錨點與方向，3寬×2深共6格內所有棋子消除。一場限一次。",
  },
};
const CLASS_SKILLS_UI: Record<ClassType, SkillType[]> = {
  WARRIOR: ["HORIZONTAL_SLASH", "VERTICAL_SLASH", "HEAVEN_EARTH_REVERSAL"],
  ARCHER: ["PRECISION_SNIPE", "SCATTER_SHOT", "PIONEER_STAR"],
};
const classLabel = (c: ClassType) => (c === "WARRIOR" ? "⚔️ 劍士" : "🏹 弓箭手");
const DIR_LABEL: Record<SkillDirection, string> = { UP: "上", DOWN: "下", LEFT: "左", RIGHT: "右" };
/** direction options per skill: 橫劈 UP/DOWN、縱劈 LEFT/RIGHT、大絕四向 */
const skillDirs = (s: SkillType): SkillDirection[] =>
  s === "HORIZONTAL_SLASH" ? ["UP", "DOWN"] : s === "VERTICAL_SLASH" ? ["LEFT", "RIGHT"] : ["UP", "DOWN", "LEFT", "RIGHT"];

// ── 真劍勝負 skill-cast VFX + field-event warnings (機能性技能動畫＋場地警示) ──

type AnyEvent = Pick<SkillEvent, "eventType" | "row" | "col">;

/**
 * Build the caster-side SkillAnim spec (the local/MSW direct-apply path,
 * exercised by e2e — see applyDuelState below). Uses the exact cast context
 * (placed cells / chosen direction / ultimate anchor) the caster's own UI
 * already knows, plus this settlement's skillEvents for the affected cells.
 * Returns null when the skill produced nothing worth animating (e.g. an
 * ultimate cast entirely on empty cells still gets its box, but a skill with
 * no context at all — shouldn't happen — safely no-ops).
 */
function buildCasterSkillAnim(
  skillType: SkillType,
  ctx: {
    events: AnyEvent[];
    placed: Cell[];
    slashDir: SkillDirection | null;
    anchor: Cell | null;
    ultimateDir: SkillDirection | null;
    snipeTarget: Cell | null;
    N: number;
    /** Pushed-stone slide tween data (劈砍撞擊緩動) — origin/destination/color
     * per stone, computed by the caller from the pre-move board snapshot
     * (see place()'s submitMove). Only populated for the two slash skills. */
    slideMoves?: SlideMove[];
  },
): SkillAnim | null {
  switch (skillType) {
    case "HORIZONTAL_SLASH":
    case "VERTICAL_SLASH": {
      if (!ctx.slashDir || !ctx.placed[0]) return null;
      const waveIdx = ctx.events.findIndex((e) => e.eventType === "WAVE_SURGED");
      const preWave = waveIdx === -1 ? ctx.events : ctx.events.slice(0, waveIdx);
      const pushed = preWave.filter(
        (e) => e.eventType === "STONE_PUSHED" || e.eventType === "STONE_REMOVED_OFF_BOARD",
      );
      const delta = DIR_DELTA[ctx.slashDir];
      const cells = pushed
        .filter((e) => e.row != null && e.col != null)
        .map((e) => ({ row: e.row! + delta.dr, col: e.col! + delta.dc }));
      if (!cells.length) return null;
      return {
        kind: "slash",
        axis: skillType === "HORIZONTAL_SLASH" ? "row" : "col",
        origin: { row: ctx.placed[0].row, col: ctx.placed[0].col },
        cells,
        moves: ctx.slideMoves?.length ? ctx.slideMoves : undefined,
      };
    }
    case "HEAVEN_EARTH_REVERSAL": {
      if (!ctx.anchor || !ctx.ultimateDir) return null;
      const box = ultimateRect(ctx.anchor, ctx.ultimateDir, ctx.N);
      const flipCells = ctx.events
        .filter((e) => e.eventType === "COLORS_SWAPPED" && e.row != null && e.col != null)
        .map((e) => ({ row: e.row!, col: e.col! }));
      return { kind: "reversal", box, flipCells };
    }
    case "PIONEER_STAR": {
      if (!ctx.anchor || !ctx.ultimateDir) return null;
      const box = ultimateRect(ctx.anchor, ctx.ultimateDir, ctx.N);
      const clearCells = ctx.events
        .filter((e) => e.eventType === "STONES_CLEARED" && e.row != null && e.col != null)
        .map((e) => ({ row: e.row!, col: e.col! }));
      return { kind: "pioneer", box, clearCells };
    }
    case "PRECISION_SNIPE":
      return ctx.snipeTarget ? { kind: "snipe", target: ctx.snipeTarget } : null;
    case "SCATTER_SHOT":
      return ctx.placed.length === 2
        ? { kind: "scatter", targets: ctx.placed.map((c) => ({ row: c.row, col: c.col })) }
        : null;
    default:
      return null;
  }
}

/**
 * Best-effort broadcast-side SkillAnim (all viewers on the STOMP path — the
 * caster included: in real-backend online mode submitMove deliberately skips
 * the direct-apply path, so this broadcast IS everyone's anim source; MSW
 * never sends a duel broadcast, that path uses buildCasterSkillAnim).
 * Reuses the events' own coordinates directly (no origin+delta arithmetic —
 * the real backend's STONE_PUSHED row/col is already the destination cell).
 * `extras` (bug fix 散射/劈砍): scatterTargets = the two landed cells derived
 * by the caller from the authoritative stones-snapshot diff (SCATTER_SHOT has
 * no event signature at all); slideMoves = pushed-stone origin→destination
 * tweens derived from the pre-broadcast board, so slashes show 推子 slides on
 * the broadcast path too, same as the caster-side MSW path.
 */
function buildBroadcastSkillAnim(
  skill: SkillType,
  events: AnyEvent[],
  lastMove: Cell | null,
  extras?: { scatterTargets?: Cell[]; slideMoves?: SlideMove[] },
): SkillAnim | null {
  switch (skill) {
    case "HORIZONTAL_SLASH":
    case "VERTICAL_SLASH": {
      const waveIdx = events.findIndex((e) => e.eventType === "WAVE_SURGED");
      const preWave = waveIdx === -1 ? events : events.slice(0, waveIdx);
      const pushed = preWave
        .filter((e) => e.eventType === "STONE_PUSHED" || e.eventType === "STONE_REMOVED_OFF_BOARD")
        .filter((e) => e.row != null && e.col != null)
        .map((e) => ({ row: e.row!, col: e.col! }));
      if (!pushed.length || !lastMove) return null;
      return {
        kind: "slash",
        axis: skill === "HORIZONTAL_SLASH" ? "row" : "col",
        origin: lastMove,
        cells: pushed,
        moves: extras?.slideMoves?.length ? extras.slideMoves : undefined,
      };
    }
    case "SCATTER_SHOT":
      return extras?.scatterTargets?.length
        ? { kind: "scatter", targets: extras.scatterTargets.map((c) => ({ row: c.row, col: c.col })) }
        : null;
    case "HEAVEN_EARTH_REVERSAL": {
      const cells = events
        .filter((e) => e.eventType === "COLORS_SWAPPED" && e.row != null && e.col != null)
        .map((e) => ({ row: e.row!, col: e.col! }));
      return cells.length ? { kind: "reversal", box: cells, flipCells: cells } : null;
    }
    case "PIONEER_STAR": {
      const cells = events
        .filter((e) => e.eventType === "STONES_CLEARED" && e.row != null && e.col != null)
        .map((e) => ({ row: e.row!, col: e.col! }));
      return cells.length ? { kind: "pioneer", box: cells, clearCells: cells } : null;
    }
    case "PRECISION_SNIPE": {
      const e = events.find((e) => e.eventType === "STONE_REPLACED" && e.row != null && e.col != null);
      return e ? { kind: "snipe", target: { row: e.row!, col: e.col! } } : null;
    }
    default:
      return null;
  }
}

/**
 * 場地事件警示（海浪結算 / 漲潮觸發 / 沙灘侵蝕）— non-blocking toasts, one per
 * distinct event type present in this settlement (a single wave can carry
 * more than one, e.g. WAVE_SURGED + SAND_ERODED together).
 */
function announceFieldEvents(events: AnyEvent[] | null | undefined) {
  if (!events?.length) return;
  const types = new Set(events.map((e) => e.eventType));
  if (types.has("WAVE_SURGED")) toast("🌊 海浪來襲！", "info", 2500);
  if (types.has("TIDE_TRIGGERED")) toast("🌊 漲潮了！", "tide", 3500);
  if (types.has("SAND_ERODED")) toast("海洋侵蝕了一排沙灘！", "info", 2500);
}

/** Game board play — ports prototype/game (server-authoritative moves, win
 *  highlight, 4 result scenarios, reconnect, spectator read-only). */
export default function GamePage() {
  const params = useParams<{ gameId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const gameId = params.gameId;
  const mode = search.get("mode") || "local"; // local | online
  const isGuest = useSession((s) => s.identity) === "guest";
  const myId = useSession((s) => s.playerId);
  // Bug fix: identity used to come solely from the ?role=spectator URL param, so
  // any navigation path that forgot to attach it (e.g. the room page's
  // GameStarted broadcast handler before its own fix) silently treated a
  // spectator as a player — interactive board, could attempt moves that the
  // backend would then reject one-by-one. Fallback: once both colors are
  // revealed (ONLINE mode, blackPlayerId/whitePlayerId resolved via replay
  // below), anyone whose id matches neither color is a spectator even with no
  // role param at all.
  const [blackPlayerId, setBlackPlayerId] = useState<string | null>(null);
  const [whitePlayerId, setWhitePlayerId] = useState<string | null>(null);
  const isSpectator =
    search.get("role") === "spectator" ||
    (mode === "online" &&
      !!myId &&
      !!blackPlayerId &&
      !!whitePlayerId &&
      myId !== blackPlayerId &&
      myId !== whitePlayerId);
  // UI fix (對手回合不顯示對手技能): a player's own fixed color, resolvable
  // only in online mode once the replay has echoed both ids — local/hotseat
  // mode has no such fixed identity (both sides share this one client, and
  // the skill bar intentionally keeps following `turn` there, see below).
  // Unknown (ids not yet loaded) safely falls back to the pre-fix behavior.
  const myColor: Color | null =
    mode === "online" && myId && blackPlayerId && whitePlayerId
      ? myId === blackPlayerId
        ? "BLACK"
        : myId === whitePlayerId
          ? "WHITE"
          : null
      : null;

  const [stones, setStones] = useState<PlacedStone[]>([]);
  const [openingStones, setOpeningStones] = useState<PlacedStone[]>([]);
  const [turn, setTurn] = useState<Color>("BLACK");
  const [moveCount, setMoveCount] = useState(0);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [highlight, setHighlight] = useState<[number, number][]>([]);
  const [result, setResult] = useState<GameStateResponse["result"]>(null);
  const [seconds, setSeconds] = useState(0);
  const [conn, setConn] = useState<ConnState>(mode === "online" ? "reconnecting" : "online");
  const [showResult, setShowResult] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [touchConfirm, setTouchConfirm] = useState(false);
  const [hasCursor, setHasCursor] = useState(false);
  // ── 真劍勝負 state (需求 #34–#48) ──
  const [duel, setDuel] = useState<{ fieldType: FieldType; blackClass: ClassType; whiteClass: ClassType } | null>(null);
  const [obstacles, setObstacles] = useState<Cell[]>([]);
  const [oceanSide, setOceanSide] = useState<OceanSide | null>(null);
  const [erodedRows, setErodedRows] = useState(0);
  const [tideTriggered, setTideTriggered] = useState(false);
  const [revealed, setRevealed] = useState<RevealedCell[]>([]);
  const [usedSkills, setUsedSkills] = useState<Record<Color, SkillType[]>>({ BLACK: [], WHITE: [] });
  const [activeSkill, setActiveSkill] = useState<SkillType | null>(null);
  const [skillDir, setSkillDir] = useState<SkillDirection | null>(null);
  const [scatterFirst, setScatterFirst] = useState<Cell | null>(null);
  // 散射 (SCATTER_SHOT) placement guide 需求：第 2 子選定後不立刻送出，
  // 停在「確認送出」這一步（見下方 confirmScatterSubmit）。
  const [scatterSecond, setScatterSecond] = useState<Cell | null>(null);
  const [previewCells, setPreviewCells] = useState<FieldCell[] | null>(null);
  // 技能說明 tooltip（桌機 hover + 行動版 ⓘ 點開共用同一顆狀態）。
  const [tooltipSkill, setTooltipSkill] = useState<SkillType | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [revealFlipped, setRevealFlipped] = useState(false);
  const revealShownRef = useRef(false);
  const stompRef = useRef<StompClient | null>(null);
  const boardRef = useRef<BoardHandle>(null);
  const mountedRef = useRef(true);
  // 是否曾經成功連線過一次 —— 用來分辨「初次連線」與「斷線後重連成功」。
  const hasBeenOnlineRef = useRef(false);
  // bug fix (real-backend duel effects): the STOMP GameStateUpdated payload only
  // carries a single lastMove point + skill/field events without enough delta
  // info to replay client-side (scatter shot's 2nd stone, push direction for a
  // remote/spectator viewer, actor color for an ultimate anchor move with 0
  // placements). Reusing the already-battle-tested replay-based rebuild (same
  // one used on initial load/reconnect) instead of the plain lastMove-only
  // applyState is the low-risk fix — every viewer (actor/opponent/spectator)
  // ends up re-deriving the authoritative full board from GET /replay whenever
  // a duel game's broadcast arrives. `duel` itself can't be read directly
  // inside the STOMP subscribe callback below (effect only runs once per
  // gameId/mode, so the closure would see the stale null from first render) —
  // mirror it into a ref that's always current.
  const duelRef = useRef<{ fieldType: FieldType; blackClass: ClassType; whiteClass: ClassType } | null>(null);
  // UI fix (對手施放技能提示): mirrors of `turn`/`myColor` for use inside the
  // STOMP broadcast callback (applyDuelBroadcast, same staleness concern as
  // duelRef above) — turnRef captures who just acted (read BEFORE the
  // broadcast's own setTurn call overwrites it) and myColorRef lets that
  // callback suppress "opponent cast a skill" toasts about the viewer's own
  // moves once a real online identity is known.
  const turnRef = useRef<Color>("BLACK");
  const myColorRef = useRef<Color | null>(null);
  // Bug fix (散射/劈砍 broadcast anims): the pre-broadcast board, for deriving
  // scatter's two landed cells (snapshot diff) and slash slide-tween colors
  // inside the STOMP callback (same staleness concern as the refs above).
  const stonesRef = useRef<PlacedStone[]>([]);

  // Bug fix: online p1Name/p2Name used to be hardcoded placeholder strings.
  // Real nicknames + correct black/white mapping are resolved below once the
  // replay (which carries roomId/blackPlayerId/whitePlayerId) loads.
  const [p1Name, setP1Name] = useState(mode === "local" ? "玩家一" : "黑方");
  const [p2Name, setP2Name] = useState(mode === "local" ? "玩家二" : "白方");

  useEffect(() => {
    setTouchConfirm(typeof window !== "undefined" && window.matchMedia("(max-width:640px)").matches);
  }, []);

  useEffect(() => {
    duelRef.current = duel;
  }, [duel]);
  useEffect(() => {
    myColorRef.current = myColor;
  }, [myColor]);
  // Synced after every render (i.e. reflects the CURRENT turn by the time the
  // next broadcast arrives) — applyDuelBroadcast reads turnRef.current at
  // its very top, before its own setTurn(state.currentTurn) call, so it sees
  // who acted in THIS settlement, not the new turn the broadcast just set.
  useEffect(() => {
    turnRef.current = turn;
  }, [turn]);
  useEffect(() => {
    stonesRef.current = stones;
  }, [stones]);

  useEffect(() => {
    // reset on (re)mount: React StrictMode's dev unmount/remount keeps the
    // ref instance, so without this the flag stays false after the simulated
    // unmount and loadReplay() bails out before applying any server state.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // clock (pause when tab hidden)
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden && !result) setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [result]);

  // online: subscribe to game state broadcast (需求 #16) + reconnect badge (需求 #9)
  useEffect(() => {
    if (mode !== "online") return;
    const client = new StompClient();
    client.onState = setConn;
    client.connect();
    client.subscribe<GameStateResponse>(channels.game(gameId), (state) => {
      // Serious Duel: the broadcast's lastMove/skillEvents alone aren't enough
      // to replay client-side for every viewer — see applyDuelBroadcast below
      // for why (backend's event row/col semantics don't match what the
      // client-side event replay assumed).
      // Also check the payload's own duel-only fields (not just duelRef) —
      // avoids a race on the very first hand where this broadcast could
      // arrive before the mount-time loadReplay() has populated duelRef.
      const isDuel = !!(duelRef.current || state.blackClass || state.whiteClass || state.fieldState);
      if (isDuel) {
        applyDuelBroadcast(state);
        return;
      }
      applyState(state);
    });
    stompRef.current = client;
    return () => client.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, mode]);

  // 載入對局目前狀態（Swap2 開局子 + 已落子 + 當前回合），整組重建（非 append）。
  // 無 GET /games/{id} 端點 → 用 /replay 重建。需求 #30：開局後輪次依嚴格交替。
  // 對全新對局（0 子）保持預設（黑方先手）。online 晚進場者/重連者都能同步當前盤面。
  // 抽成可重用函式：掛載時載入一次，斷線重連成功時也要重跑一次，補齊斷線
  // 期間漏接的廣播（手機鎖屏/背景斷線的修復核心）。
  const loadReplay = useCallback(async () => {
    try {
      const replay = await gameService.replay(gameId);
      if (!mountedRef.current) return;
      // 觀戰者身份 fallback 用（見上方 isSpectator）：replay 一律帶 blackPlayerId/
      // whitePlayerId（不限真劍勝負），一有值就記錄，供「無 role 參數」時判斷。
      setBlackPlayerId(replay.blackPlayerId ?? null);
      setWhitePlayerId(replay.whitePlayerId ?? null);
      // 線上模式：用 replay 帶回的 roomId 查房間成員取得真實暱稱，
      // 並依 blackPlayerId/whitePlayerId 正確對應黑白子（修正原本寫死假名的 bug）。
      if (mode === "online" && replay.roomId) {
        try {
          const room = await roomService.get(replay.roomId);
          if (mountedRef.current) {
            const nickOf = (id: string | null | undefined) =>
              room.members.find((m) => m.playerId === id)?.nickname;
            const label = (id: string | null | undefined) => {
              const nick = nickOf(id) ?? "對手";
              return id && myId && id === myId ? `${nick}（你）` : nick;
            };
            if (replay.blackPlayerId) setP1Name(label(replay.blackPlayerId));
            if (replay.whitePlayerId) setP2Name(label(replay.whitePlayerId));
          }
        } catch (err) {
          // 查詢房間失敗 → 保留「黑方」/「白方」預設標籤；non-ApiError（如 schema
          // 不合的 ZodError）不應無聲吞掉，否則同類 mismatch 又會再次難以排查。
          if (!(err instanceof ApiError)) console.error("loadReplay: room fetch failed", err);
        }
      }
      // ── 真劍勝負：以完整事件時間軸重建盤面（推擠/燒毀/互換不在 moves 裡）──
      if (replay.battleMode === "SERIOUS_DUEL" && replay.fieldType && replay.blackClass && replay.whiteClass) {
        const size = replay.fieldType === "BEACH" ? 16 : 15;
        // bug fix: prefer the authoritative obstacles/seaSide snapshot (real backend
        // always sends FIELD_GENERATED with row=col=null, so the old fallback that
        // inferred them from fieldEvents alone silently rendered BEACH as if the
        // ocean were always on the top edge, and never showed VOLCANO obstacles).
        const meta = duelFieldMeta(replay.fieldEvents, replay.fieldType, size, replay.seaSide ?? undefined);
        setDuel({ fieldType: replay.fieldType, blackClass: replay.blackClass, whiteClass: replay.whiteClass });
        setObstacles(replay.obstacles ?? meta.obstacles);
        setOceanSide(meta.oceanSide);
        // 重連/重新整理：以伺服器紀錄還原技能已用狀態（前端本地追蹤在此之前會重置為 0/3，
        // 造成已用技能誤判為可再用；R2-3 要求技能已用狀態隨重連機制一併恢復）。
        if (replay.skillUsages) {
          const restored: Record<Color, SkillType[]> = { BLACK: [], WHITE: [] };
          for (const su of replay.skillUsages) {
            const color: Color | null =
              su.playerId === replay.blackPlayerId ? "BLACK"
                : su.playerId === replay.whitePlayerId ? "WHITE"
                  : null;
            if (color) restored[color].push(su.skillType);
          }
          setUsedSkills(restored);
        }
        // 開局揭曉（Q8）：對局開始（moveCount 0）時翻牌揭曉雙方職業
        if (!revealShownRef.current && replay.moveCount === 0) {
          revealShownRef.current = true;
          setShowReveal(true);
          setTimeout(() => setRevealFlipped(true), 400);
          setTimeout(() => setShowReveal(false), 3000);
        }
        // bug fix: don't gate on moveCount>0 alone — a hand that ONLY casts an
        // ultimate (anchor cell must stay empty, Q4) places 0 stones, so the very
        // first hand of a game can leave moveCount at 0 even though a turn has
        // already passed (currentTurn already flipped). Any non-FIELD_GENERATED
        // field event proves at least one hand was played even with 0 stones.
        const anyHandPlayed =
          replay.moveCount > 0 ||
          (replay.fieldEvents ?? []).some((e) => e.eventType !== "FIELD_GENERATED");
        if (anyHandPlayed) {
          const steps = duelSnapshots(replay);
          const lastStep = steps[steps.length - 1];
          setStones(lastStep.stones);
          setRevealed(lastStep.revealed);
          setErodedRows(lastStep.erodedRows);
          setTideTriggered(lastStep.tideTriggered);
          setMoveCount(replay.moveCount);
          if (lastStep.move) setLastMove([lastStep.move.r, lastStep.move.c]);
          // bug fix: duelSnapshots (and its shared applyDuelEvents helper)
          // replay skillEvents client-side, but the real backend's per-event
          // row/col semantics don't match what that replay assumes (see
          // applyDuelBroadcast doc below) — so lastStep.stones can be wrong
          // for any duel that used a push/burn/swap effect. Overwrite with
          // the backend's own authoritative snapshot when reachable; keep
          // the replay-derived value as a fallback if this call fails (e.g.
          // offline/MSW without a GET /games/{id} fixture).
          try {
            const authoritative = await gameService.getState(gameId);
            if (mountedRef.current && authoritative.stones) {
              setStones(authoritative.stones.map((s) => ({ r: s.row, c: s.col, color: lc(s.color) })));
            }
          } catch (err) {
            if (!(err instanceof ApiError)) console.error("loadReplay: getState fallback failed", err);
          }
          // bug fix: moveCount parity is unreliable here — an ultimate cast places
          // 0 stones and scatter-shot places 2 in one hand, so "odd/even stones
          // placed" does not track "whose turn" once either skill has been used.
          // Use the server-authoritative currentTurn (added to GameReplayResponse)
          // instead, falling back to the old parity guess only if it's absent.
          setTurn(replay.currentTurn ?? (replay.moveCount % 2 === 1 ? "WHITE" : "BLACK"));
        }
        return;
      }
      const opening = [...replay.openingStones]
        .sort((a, b) => a.sequence - b.sequence)
        .map((s) => ({ r: s.row, c: s.col, color: lc(s.color) }));
      const moves = [...replay.moves]
        .sort((a, b) => a.moveNumber - b.moveNumber)
        .map((m) => ({ r: m.row, c: m.col, color: lc(m.color) }));
      const all = [...opening, ...moves];
      if (all.length === 0) return; // 全新局，保留黑方先手預設
      setOpeningStones(opening);
      setStones(all);
      setMoveCount(replay.moves.length);
      const last = moves[moves.length - 1] ?? opening[opening.length - 1];
      if (last) setLastMove([last.r, last.c]);
      // N 子已落：N 奇→白方續落，偶→黑方（與後端 currentTurn 一致）
      setTurn(all.length % 2 === 1 ? "WHITE" : "BLACK");
    } catch (err) {
      // 全新局或 replay 不可用 → 保留預設；non-ApiError（schema mismatch 等）
      // 印出來，避免真正的 bug（如 ZodError）被誤當成「新局」而無聲吃掉
      // （這正是真劍勝負 duel 狀態靜默不渲染的根因，見 schemas.ts 的修法）。
      if (!(err instanceof ApiError)) console.error("loadReplay failed", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, mode, myId]);

  // 依賴 loadReplay（含 myId）：session 從 localStorage 還原較慢時，
  // myId 就緒後會重跑一次，確保「（你）」標籤正確補上。
  useEffect(() => {
    loadReplay();
  }, [loadReplay]);

  // 斷線重連修復：conn 從非 online 轉回 online 時（首次連線除外，因為上面的
  // effect 已經載入過一次），代表 STOMP 剛重新建立連線 —— 斷線期間可能漏接
  // 對方落子的廣播，整組重抓 replay 重建盤面，不是靠 append 補洞。
  useEffect(() => {
    if (mode !== "online") return;
    if (conn === "online") {
      if (hasBeenOnlineRef.current) {
        loadReplay();
      }
      hasBeenOnlineRef.current = true;
    }
  }, [conn, mode, loadReplay]);

  const applyState = useCallback((state: GameStateResponse) => {
    if (state.lastMove) {
      const { row, col, color } = state.lastMove;
      setStones((prev) =>
        // 防重複：斷線重連時 loadReplay() 可能已經把這手補進來了，
        // 若該格已有子就跳過，避免同一手疊兩次。
        prev.some((s) => s.r === row && s.c === col) ? prev : [...prev, { r: row, c: col, color: lc(color) }],
      );
      setLastMove([row, col]);
    }
    setMoveCount(state.moveCount);
    if (state.currentTurn) setTurn(state.currentTurn);
    if (state.status === "FINISHED") {
      setResult(state.result);
      if (state.winningLine) setHighlight(state.winningLine.map((c) => [c.row, c.col]));
      setTimeout(() => setShowResult(true), 900);
    }
  }, []);

  /**
   * UI fix（對手施放技能提示）: non-blocking banner announcing a skill cast,
   * auto-dismissing after ~3s (toast()'s default ttl). Suppressed only when
   * the viewer's own fixed color is known (real online identity) and
   * matches the actor — i.e. don't tell a player "the opponent" used a
   * skill they themselves just used. In local/hotseat play (myColorRef.
   * current is always null there — no fixed per-client identity) this
   * always fires, which is exactly the desired behavior: control has just
   * passed to the other side of the shared screen, so announcing what the
   * previous mover did is the correct "opponent's move" framing for them.
   */
  function announceSkillCast(actorColor: Color, skill: SkillType) {
    if (myColorRef.current && myColorRef.current === actorColor) return;
    toast(`⚡ 對方發動了 ${SKILL_INFO[skill].name}！`, "skill", 3000);
  }

  /**
   * Serious Duel STOMP broadcast handler (bug fix). GameStateResponse.stones
   * is the backend's authoritative occupied-cell snapshot — trust it
   * directly instead of client-side replaying skillEvents, because the
   * event replay (duelClient.ts applyDuelEvents) assumes row/col semantics
   * that don't match the real backend: STONES_BURNED's row/col is the
   * ERUPTION trigger cell (not the burned neighbors, which is why the
   * neighbors never disappeared), STONE_PUSHED's is the push destination
   * (not the origin the client assumed a delta should be applied from).
   * skillEvents/revealedHiddenCells are still used for reveal bookkeeping
   * (their row/col IS unambiguous — the trigger cell's own coordinates).
   * No flash-cell FX here (best-effort trade-off for a remote viewer who
   * has no local skill-cast context); the board itself renders correctly,
   * which is what bugs A/B/C were actually about.
   */
  const applyDuelBroadcast = useCallback(
    (state: GameStateResponse) => {
      // Capture who just acted BEFORE setTurn(state.currentTurn) below
      // overwrites turnRef's next value (via its mirroring effect) — see
      // turnRef's own doc comment.
      const actorColor = turnRef.current;
      // Pre-broadcast board (see stonesRef doc): captured BEFORE setStones
      // below replaces it with the authoritative snapshot.
      const prevStones = stonesRef.current;
      if (state.stones) {
        setStones(state.stones.map((s) => ({ r: s.row, c: s.col, color: lc(s.color) })));
      } else {
        // Defensive fallback (old backend / unexpected payload without the
        // new field) — full rebuild via replay, same as reconnect.
        loadReplay();
      }
      if (state.lastMove) setLastMove([state.lastMove.row, state.lastMove.col]);
      setMoveCount(state.moveCount);
      if (state.currentTurn) setTurn(state.currentTurn);
      // 對手施放技能提示＋動畫（bug fix, 2026-07-07）: prefer the payload's own
      // additive `skillType` (api.yml GameStateResponse.skillType) — event
      // inference broke for slashes on the real backend (STONE_PUSHED row/col
      // is the push DESTINATION, 2 cells from the move, so the adjacency-based
      // inferSkillCast returned null → 橫劈/縱劈 showed no blade/toast for any
      // viewer, the caster included, since online real-backend mode renders
      // everything from this broadcast) and can never work for SCATTER_SHOT
      // (no event signature). inferSkillCast stays as the fallback for older
      // backend payloads without the field.
      const events = state.skillEvents ?? [];
      const lastMoveCell = state.lastMove ? { row: state.lastMove.row, col: state.lastMove.col } : null;
      const skillCast = state.skillType ?? (events.length ? inferSkillCast(events, lastMoveCell) : null);
      if (skillCast) {
        announceSkillCast(actorColor, skillCast);
        // 散射（bug fix）：no event signature — the two landed cells are the
        // actor-colored stones present in the authoritative snapshot but not
        // on the pre-broadcast board.
        let scatterTargets: Cell[] | undefined;
        if (skillCast === "SCATTER_SHOT" && state.stones) {
          const before = new Set(prevStones.map((s) => cellKey(s.r, s.c)));
          scatterTargets = state.stones
            .filter((s) => lc(s.color) === lc(actorColor) && !before.has(cellKey(s.row, s.col)))
            .map((s) => ({ row: s.row, col: s.col }));
        }
        // 劈砍推子滑動（bug fix）：derive each pushed stone's origin (destination
        // minus one step along the push direction) + color from the
        // pre-broadcast board, so the broadcast path tweens stones exactly
        // like the caster-side MSW path instead of teleporting them.
        let slideMoves: SlideMove[] | undefined;
        if ((skillCast === "HORIZONTAL_SLASH" || skillCast === "VERTICAL_SLASH") && lastMoveCell) {
          const waveIdx = events.findIndex((e) => e.eventType === "WAVE_SURGED");
          const preWave = waveIdx === -1 ? events : events.slice(0, waveIdx);
          const axis: "row" | "col" = skillCast === "HORIZONTAL_SLASH" ? "row" : "col";
          const prevMap = new Map(prevStones.map((s) => [cellKey(s.r, s.c), s.color]));
          slideMoves = preWave
            .filter((e) => e.eventType === "STONE_PUSHED" && e.row != null && e.col != null)
            .map((e) => {
              const to = { row: e.row!, col: e.col! };
              const sign = Math.sign(axis === "row" ? to.row - lastMoveCell.row : to.col - lastMoveCell.col) || 1;
              const from = axis === "row" ? { row: to.row - sign, col: to.col } : { row: to.row, col: to.col - sign };
              const color = prevMap.get(cellKey(from.row, from.col));
              return color ? { from, to, color } : null;
            })
            .filter((m): m is SlideMove => m !== null);
        }
        const anim = buildBroadcastSkillAnim(skillCast, events, lastMoveCell, { scatterTargets, slideMoves });
        if (anim) {
          const duration = anim.kind === "reversal" || anim.kind === "pioneer" ? 1500 : 700;
          boardRef.current?.playSkillAnim(anim, duration);
        }
      }
      // 場地事件警示（新增，需求 #2）：海浪來襲/漲潮/侵蝕 — 每位觀眾（含觀戰者）都看得到。
      announceFieldEvents(state.skillEvents);
      if (state.revealedHiddenCells?.length) {
        setRevealed((prev) => {
          const seen = new Set(prev.map((rc) => cellKey(rc.row, rc.col)));
          const added = state.revealedHiddenCells!
            .filter((rc) => !seen.has(cellKey(rc.row, rc.col)))
            .map((rc) => ({ row: rc.row, col: rc.col, kind: rc.cellKind }));
          return added.length ? [...prev, ...added] : prev;
        });
      }
      if (state.fieldState) {
        setErodedRows(state.fieldState.erodedRows);
        setTideTriggered(state.fieldState.tideTriggered);
      }
      if (state.status === "FINISHED") {
        setResult(state.result);
        if (state.winningLine) setHighlight(state.winningLine.map((c) => [c.row, c.col]));
        setTimeout(() => setShowResult(true), 900);
      }
    },
    [loadReplay],
  );

  function clearSkillUi() {
    setActiveSkill(null);
    setSkillDir(null);
    setScatterFirst(null);
    setScatterSecond(null);
    setPreviewCells(null);
  }

  /** 真劍勝負：套用一次結算（落子 + 事件差分 + 特效 + 揭露 + 勝負）。 */
  const applyDuelState = useCallback(
    (
      state: GameStateResponse,
      ctx: {
        placed: Cell[];
        actor: Color;
        slashDir: SkillDirection | null;
        skillType: SkillType | null;
        // 機能性技能動畫（新增）用的額外施放脈絡 — 大絕錨點/方向、精準狙擊目標、
        // 場地大小；一般落子/劈砍技能不需要這三者，留 null 即可。
        anchor: Cell | null;
        ultimateDir: SkillDirection | null;
        snipeTarget: Cell | null;
        boardSize: number;
        // 劈砍撞擊緩動（新增）：pushed-stone origin/destination/color, computed
        // by the caller (submitMove) from the pre-move board — only slash
        // skills populate this; see buildCasterSkillAnim's doc.
        slideMoves?: SlideMove[];
      },
    ) => {
      setStones((prev) => {
        const map: StoneMap = {};
        prev.forEach((s) => (map[cellKey(s.r, s.c)] = s.color));
        for (const cell of ctx.placed) map[cellKey(cell.row, cell.col)] = lc(ctx.actor);
        // Flash-cell FX are still derived from the local event replay (best
        // effort; the actor has the direction/actor context this needs).
        const flashes = applyDuelEvents(map, state.skillEvents ?? [], {
          slashDir: ctx.slashDir,
          waveDir: oceanSide ? wavePushDirection(oceanSide) : null,
          actor: lc(ctx.actor),
        });
        for (const f of flashes) boardRef.current?.flashCells(f.cells, f.type);
        // bug fix: the resulting stone POSITIONS come from the backend's
        // authoritative `stones` snapshot when present, not from the above
        // replay — the event replay's row/col assumptions don't match the
        // real backend for STONES_BURNED/STONE_PUSHED (see applyDuelBroadcast
        // doc). Fall back to the replayed map for older payloads without it
        // (e.g. MSW fixtures in duel.spec.ts).
        return state.stones
          ? state.stones.map((s) => ({ r: s.row, c: s.col, color: lc(s.color) }))
          : stonesFromMap(map);
      });
      if (state.lastMove) setLastMove([state.lastMove.row, state.lastMove.col]);
      setMoveCount(state.moveCount);
      if (state.currentTurn) setTurn(state.currentTurn);
      // UI fix（對手施放技能提示）: the direct-apply path already knows the
      // exact skill (the caster's own UI selection) — no inference needed.
      if (ctx.skillType) announceSkillCast(ctx.actor, ctx.skillType);
      // 機能性技能動畫（新增）：六技能各自的方向性 canvas 動畫，見
      // buildCasterSkillAnim 文件；資料來源為本次結算的 skillEvents + 施放
      // 當下的本地脈絡（方向/錨點/目標）。0.5–1s、不阻擋操作（純 canvas 疊繪）。
      if (ctx.skillType) {
        const anim = buildCasterSkillAnim(ctx.skillType, {
          events: state.skillEvents ?? [],
          placed: ctx.placed,
          slashDir: ctx.slashDir,
          anchor: ctx.anchor,
          ultimateDir: ctx.ultimateDir,
          snipeTarget: ctx.snipeTarget,
          N: ctx.boardSize,
          slideMoves: ctx.slideMoves,
        });
        // 大絕（天地反轉／開拓之星）拉長到 1.5s 求「大絕感」；其餘技能維持 0.7s。
        if (anim) {
          const duration = anim.kind === "reversal" || anim.kind === "pioneer" ? 1500 : 700;
          boardRef.current?.playSkillAnim(anim, duration);
        }
      }
      // 場地事件警示（新增，需求 #2）：海浪來襲/漲潮/侵蝕。
      announceFieldEvents(state.skillEvents);
      // 隱藏格揭露累積（觸發時 + 終局全揭露，需求 #44；依 key 去重）
      if (state.revealedHiddenCells?.length) {
        setRevealed((prev) => {
          const seen = new Set(prev.map((rc) => cellKey(rc.row, rc.col)));
          const added = state.revealedHiddenCells!
            .filter((rc) => !seen.has(cellKey(rc.row, rc.col)))
            .map((rc) => ({ row: rc.row, col: rc.col, kind: rc.cellKind }));
          return added.length ? [...prev, ...added] : prev;
        });
      }
      if (state.fieldState) {
        setErodedRows(state.fieldState.erodedRows);
        setTideTriggered(state.fieldState.tideTriggered);
      }
      if (state.status === "FINISHED") {
        setResult(state.result);
        if (state.winningLine) setHighlight(state.winningLine.map((c) => [c.row, c.col]));
        setTimeout(() => setShowResult(true), 900);
      }
    },
    [oceanSide],
  );

  /**
   * Shared duel-move submission tail (extracted so 散射's explicit "確認送出"
   * step — which must NOT submit on the 2nd board click, see place() below —
   * can reuse the exact same request/apply/catch logic as every other skill).
   */
  async function submitMove(
    req: MoveCreateRequest,
    ctx: {
      placed: Cell[];
      actor: Color;
      slashDir: SkillDirection | null;
      skillType: SkillType | null;
      anchor: Cell | null;
      ultimateDir: SkillDirection | null;
      snipeTarget: Cell | null;
    },
  ) {
    try {
      const state = await gameService.placeMove(gameId, req);
      // MSW 無 STOMP 廣播 → 直接套用回應；真後端 online 模式仍走廣播
      if (mode !== "online" || USE_MOCKS) {
        // 劈砍撞擊緩動（新增）：算出被推棋子的「推前」座標與顏色 —— 用
        // submitMove 呼叫當下（await 之前）的 `stones`（此渲染週期的閉包值，
        // 即本手落子前的盤面），搭配這次結算的 skillEvents 還原每顆被推棋子
        // 的位移，交給 GomokuBoard 做滑動補間（見 buildCasterSkillAnim 文件）。
        let slideMoves: SlideMove[] | undefined;
        if (ctx.slashDir && (ctx.skillType === "HORIZONTAL_SLASH" || ctx.skillType === "VERTICAL_SLASH")) {
          const delta = DIR_DELTA[ctx.slashDir];
          const events = state.skillEvents ?? [];
          const waveIdx = events.findIndex((e) => e.eventType === "WAVE_SURGED");
          const preWave = waveIdx === -1 ? events : events.slice(0, waveIdx);
          slideMoves = preWave
            .filter((e) => e.eventType === "STONE_PUSHED" && e.row != null && e.col != null)
            .map((e) => {
              const from = { row: e.row!, col: e.col! };
              const color = stones.find((s) => s.r === from.row && s.c === from.col)?.color;
              return color ? { from, to: { row: from.row + delta.dr, col: from.col + delta.dc }, color } : null;
            })
            .filter((m): m is SlideMove => m !== null);
        }
        applyDuelState(state, {
          placed: ctx.placed,
          actor: ctx.actor,
          slashDir: ctx.slashDir,
          skillType: ctx.skillType,
          anchor: ctx.anchor,
          ultimateDir: ctx.ultimateDir,
          snipeTarget: ctx.snipeTarget,
          boardSize: N,
          slideMoves,
        });
      }
      if (ctx.skillType) {
        const s = ctx.skillType;
        setUsedSkills((prev) => ({ ...prev, [ctx.actor]: [...prev[ctx.actor], s] }));
      }
      clearSkillUi();
    } catch (err) {
      // non-ApiError（如回應 schema 不合的 ZodError）不應被 "落子不合法" toast
      // 蓋掉——那會讓 schema mismatch（伺服器其實已接受落子）誤判成業務錯誤。
      if (!(err instanceof ApiError)) console.error("placeMove (duel) failed", err);
      const msg = err instanceof ApiError ? err.message : "落子不合法";
      toast(msg, "error");
    }
  }

  /** 散射「確認送出」— 兩子都已選定後才真正呼叫後端（需求：散射放置流程明確化）。 */
  async function confirmScatterSubmit() {
    if (!scatterFirst || !scatterSecond) return;
    const actor = turn;
    await submitMove(
      { row: scatterFirst.row, col: scatterFirst.col, skill: { skillType: "SCATTER_SHOT", secondStone: scatterSecond } },
      {
        placed: [scatterFirst, scatterSecond],
        actor,
        slashDir: null,
        skillType: "SCATTER_SHOT",
        anchor: null,
        ultimateDir: null,
        snipeTarget: null,
      },
    );
  }

  async function place(r: number, c: number) {
    if (isSpectator) {
      toast("觀戰中，無法落子", "error");
      return;
    }
    // ── 真劍勝負：依當前選取的技能組出 MoveCreateRequest（需求 #36）──
    if (duel) {
      const actor = turn;
      if (activeSkill && isUltimate(activeSkill)) {
        // 大絕：取代本回合落子；點擊格 = 錨點（必須空格，Q4 補充）
        if (!skillDir) {
          toast("請先選擇大絕方向", "error");
          return;
        }
        const anchor = { row: r, col: c };
        await submitMove(
          {
            skill: {
              skillType: activeSkill as "HEAVEN_EARTH_REVERSAL" | "PIONEER_STAR",
              direction: skillDir,
              anchor,
            },
          },
          { placed: [], actor, slashDir: null, skillType: activeSkill, anchor, ultimateDir: skillDir, snipeTarget: null },
        );
        return;
      }
      if (activeSkill === "PRECISION_SNIPE") {
        const clicked = stones.find((s) => s.r === r && s.c === c)?.color;
        if (clicked !== lc(actor === "BLACK" ? "WHITE" : "BLACK")) {
          toast("精準狙擊須點擊一顆現存的敵方棋子", "error");
          return;
        }
        const snipeTarget = { row: r, col: c };
        await submitMove(
          { row: r, col: c, skill: { skillType: "PRECISION_SNIPE", target: snipeTarget } },
          { placed: [], actor, slashDir: null, skillType: "PRECISION_SNIPE", anchor: null, ultimateDir: null, snipeTarget },
        );
        return;
      }
      if (activeSkill === "SCATTER_SHOT") {
        // 散射放置流程明確化：兩次點擊只設定預覽點，不送出——第 2 子選定後
        // 停在「確認送出」按鈕，board 上顯示 1/2 標記 + 第 1 子九宮格禁區
        // （見下方 scatterGuide / isBlocked，需求：散射桌機放置流程明確化）。
        if (!scatterFirst) {
          setScatterFirst({ row: r, col: c });
          return;
        }
        if (!scatterSecond) {
          if (Math.max(Math.abs(scatterFirst.row - r), Math.abs(scatterFirst.col - c)) < 2) {
            toast("散射兩子不得在彼此九宮格內（Chebyshev ≥ 2）", "error");
            return;
          }
          setScatterSecond({ row: r, col: c });
          return;
        }
        return; // 兩子皆已選定，等待「確認送出」／「取消」
      }
      if (activeSkill === "HORIZONTAL_SLASH" || activeSkill === "VERTICAL_SLASH") {
        if (!skillDir) {
          toast("請先選擇劈砍方向", "error");
          return;
        }
        await submitMove(
          { row: r, col: c, skill: { skillType: activeSkill, direction: skillDir } },
          {
            placed: [{ row: r, col: c }],
            actor,
            slashDir: skillDir,
            skillType: activeSkill,
            anchor: null,
            ultimateDir: null,
            snipeTarget: null,
          },
        );
        return;
      }
      await submitMove(
        { row: r, col: c },
        { placed: [{ row: r, col: c }], actor, slashDir: null, skillType: null, anchor: null, ultimateDir: null, snipeTarget: null },
      );
      return;
    }
    try {
      const state = await gameService.placeMove(gameId, { row: r, col: c });
      // online: 後端會廣播到 /topic/game/{id}，雙方（含落子方）都由 STOMP applyState，
      // 此處不重複套用以免同一手疊兩次；本地無訂閱，直接套用。
      if (mode !== "online") applyState(state);
    } catch (err) {
      // InvalidMoveRejected (422) — show non-blocking toast (MoveToast)
      // non-ApiError (e.g. response schema mismatch) shouldn't be masked as
      // a bogus business rejection — surface it so mismatches aren't silent.
      if (!(err instanceof ApiError)) console.error("placeMove failed", err);
      const msg = err instanceof ApiError ? err.message : "落子不合法";
      toast(msg, "error");
    }
  }

  // UI fix（對手回合不顯示對手技能）: which color's skill list the bar shows.
  // An online player locks to their own fixed color (never swaps to show
  // the opponent's skills, whichever color's turn it is); local/hotseat
  // mode has no per-client identity, so it keeps the pre-fix behavior of
  // following `turn` (both sides share this one client either way).
  const visibleSkillColor: Color = myColor ?? turn;
  const notMyTurn = mode === "online" && myColor !== null && turn !== myColor;

  /** 技能列點擊：切換選取；同技能再點一次取消（需求 #36）。 */
  function onSkillClick(skill: SkillType) {
    if (notMyTurn) return;
    if (usedSkills[visibleSkillColor].includes(skill)) return;
    if (activeSkill === skill) {
      clearSkillUi();
      return;
    }
    clearSkillUi();
    setActiveSkill(skill);
    if (skill === "PRECISION_SNIPE") toast("點擊一顆敵方棋子以替換成己方顏色");
    // 散射的引導文字改由下方常駐提示列（scatter-guide）顯示，不用一次性 toast。
  }

  // 任一技能選取中，Esc 可隨時退出（需求：散射流程「可按 Esc 或取消鈕退出」；
  // 對其他技能同樣適用，行為一致）。
  useEffect(() => {
    if (!activeSkill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSkillUi();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSkill]);

  function pickDir(dir: SkillDirection) {
    setSkillDir(dir);
    if (activeSkill && isUltimate(activeSkill)) {
      toast("移動游標預覽 3×2 範圍，點擊空格作為錨點");
    }
  }

  /** 大絕錨點階段：hover 即時顯示 3寬×2深 預覽框（Q4）。 */
  const N = duel?.fieldType === "BEACH" ? 16 : 15;
  function handleHover(r: number, c: number) {
    if (duel && activeSkill && isUltimate(activeSkill) && skillDir) {
      setPreviewCells(ultimateRect({ row: r, col: c }, skillDir, N));
    }
  }

  /** 散射放置流程明確化：picked-point 數字預覽 + 第 1 子九宮格禁區（僅在
   * 尚未選第 2 子時顯示，兩子皆選定後禁區解除、等待「確認送出」）。 */
  const scatterGuide: ScatterGuide | null =
    activeSkill === "SCATTER_SHOT" && (scatterFirst || scatterSecond)
      ? {
          points: [
            ...(scatterFirst ? [{ ...scatterFirst, n: 1 as const }] : []),
            ...(scatterSecond ? [{ ...scatterSecond, n: 2 as const }] : []),
          ],
          forbidden:
            scatterFirst && !scatterSecond
              ? (() => {
                  const cells: FieldCell[] = [];
                  for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                      const rr = scatterFirst.row + dr;
                      const cc = scatterFirst.col + dc;
                      if (rr >= 0 && rr < N && cc >= 0 && cc < N) cells.push({ row: rr, col: cc });
                    }
                  }
                  return cells;
                })()
              : [],
        }
      : null;
  /** 散射禁區點擊拒絕（board 端 isBlocked/onBlocked 既有機制重用，需求：
   * 「點禁區有拒絕回饋」）。 */
  const isScatterForbidden = (r: number, c: number) =>
    activeSkill === "SCATTER_SHOT" &&
    !!scatterFirst &&
    !scatterSecond &&
    Math.max(Math.abs(scatterFirst.row - r), Math.abs(scatterFirst.col - c)) < 2;

  function leave() {
    router.push("/");
  }

  const winnerName =
    result === "BLACK_WIN" ? p1Name : result === "WHITE_WIN" ? p2Name : "";

  return (
    <main className="page">
      <div className="info-bar" style={{ marginBottom: 14 }}>
        <button
          className="btn btn-ghost"
          style={{ minHeight: 38, padding: "0 14px" }}
          onClick={() => setShowLeave(true)}
        >
          ← 離開
        </button>
        <div className={`player-chip${turn === "BLACK" ? " active" : ""}`}>
          <span className="stone-dot black" />
          <span>{p1Name}</span>
          {duel && <span className="dim" style={{ fontSize: 12 }}>{classLabel(duel.blackClass)}</span>}
        </div>
        <div className={`player-chip${turn === "WHITE" ? " active" : ""}`}>
          <span className="stone-dot white" />
          <span>{p2Name}</span>
          {duel && <span className="dim" style={{ fontSize: 12 }}>{classLabel(duel.whiteClass)}</span>}
        </div>
        {duel && (
          <span className="badge badge-duel">
            {duel.fieldType === "BEACH" ? "🏖️ 沙灘 16×16" : "🌋 火山 15×15"}
          </span>
        )}
        <span className="grow" />
        <span className="dim num">第 {moveCount} 手</span>
        <span className="dim num">{fmt(seconds)}</span>
        {mode === "online" && <ConnectionBadge state={conn} />}
      </div>

      {isSpectator && (
        <div className="info-bar" style={{ marginBottom: 14, background: "#2f2533" }}>
          <span className="badge badge-spec">👁 觀戰中</span>
          <span className="dim">棋盤唯讀，無法落子</span>
          <span className="grow" />
          <span className="dim num">觀戰 3 人</span>
        </div>
      )}

      <div className="layout">
        <section>
          <Board
            ref={boardRef}
            stones={stones}
            opening={openingStones}
            lastMove={lastMove}
            highlight={highlight}
            interactive={!isSpectator && !result}
            requireConfirm={touchConfirm}
            spectating={isSpectator}
            boardSize={N}
            obstacles={duel?.fieldType === "VOLCANO" ? obstacles : undefined}
            beach={duel?.fieldType === "BEACH" && oceanSide ? { side: beachSideFor(oceanSide), erodedRows } : null}
            revealedCells={revealed}
            previewCells={previewCells}
            scatterGuide={scatterGuide}
            allowOccupied={!!duel && activeSkill === "PRECISION_SNIPE"}
            isBlocked={isScatterForbidden}
            onPlace={place}
            onCursorChange={setHasCursor}
            onHover={handleHover}
            onBlocked={(r, c) => {
              if (isScatterForbidden(r, c)) {
                toast("散射兩子不得在彼此九宮格內（Chebyshev ≥ 2）", "error");
                return;
              }
              toast(
                activeSkill && isUltimate(activeSkill) ? "大絕錨點必須是空格" : "該格為障礙物，禁止落子",
                "error",
              );
            }}
          />
          {/* 真劍勝負技能列：附掛技能與大絕（需求 #36 #42 #43）。
              本地示範/MSW 下由當前行動方操作；觀戰者唯讀。
              UI fix（對手回合不顯示對手技能）: the bar always shows
              visibleSkillColor's own skill names/options only — an online
              player's own class never swaps to the opponent's during their
              turn (only their class badge is public, revealed at kickoff);
              it's disabled (not hidden, no layout jump) while notMyTurn. */}
          {duel && !isSpectator && !result && (
            <div className="card pad mt-8" data-testid="skill-bar">
              <div className="row" style={{ marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>
                  技能（{visibleSkillColor === "BLACK" ? "黑方" : "白方"} · {classLabel(visibleSkillColor === "BLACK" ? duel.blackClass : duel.whiteClass)}）
                </b>
                <span className="grow" />
                {notMyTurn ? (
                  <span className="dim" style={{ fontSize: 12 }}>對方回合，暫時無法使用</span>
                ) : (
                  <span className="dim" style={{ fontSize: 12 }}>每個技能一場限用一次</span>
                )}
              </div>
              <div className="skill-bar">
                {CLASS_SKILLS_UI[visibleSkillColor === "BLACK" ? duel.blackClass : duel.whiteClass].map((s) => {
                  const used = usedSkills[visibleSkillColor].includes(s);
                  return (
                    <div className="skill-item" key={s}>
                      <button
                        className={`skill-btn${activeSkill === s ? " active" : ""}${used ? " used" : ""}`}
                        disabled={used || notMyTurn}
                        onClick={() => onSkillClick(s)}
                      >
                        {SKILL_INFO[s].ico} {SKILL_INFO[s].name}
                        {used ? "（已用）" : ""}
                      </button>
                      {/* 技能說明（需求）：桌機 hover 顯示、行動版點 ⓘ 開合，
                          兩者共用同一顆 tooltipSkill 狀態 + CSS hover 規則。 */}
                      <button
                        type="button"
                        className="skill-info-btn"
                        // aria-label 刻意不含技能名稱（如「橫劈」/「散射」）——避免
                        // 與既有 e2e 用 getByRole("button",{name:/橫劈/}) 選取技能
                        // 按鈕本身的正規表示式互相撞名；改用 data-testid 供測試選取。
                        aria-label="顯示技能說明"
                        data-testid={`skill-info-${s}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTooltipSkill((prev) => (prev === s ? null : s));
                        }}
                      >
                        ⓘ
                      </button>
                      <span
                        className={`skill-tooltip${tooltipSkill === s ? " open" : ""}`}
                        role="tooltip"
                        data-testid={`skill-tooltip-${s}`}
                      >
                        {SKILL_INFO[s].desc}
                      </span>
                    </div>
                  );
                })}
              </div>
              {activeSkill && skillDirs(activeSkill).length > 0 && (activeSkill === "HORIZONTAL_SLASH" || activeSkill === "VERTICAL_SLASH" || isUltimate(activeSkill)) && (
                <div className="mt-8">
                  <p className="dim" style={{ fontSize: 13, marginBottom: 6, textAlign: "center" }}>
                    {isUltimate(activeSkill)
                      ? skillDir
                        ? "已選方向 — 點擊棋盤空格作為錨點（3寬×2深）"
                        : "選擇大絕方向"
                      : "選擇劈砍方向後落子"}
                  </p>
                  <div className="dir-pad" data-testid="dir-pad">
                    {skillDirs(activeSkill).map((d) => (
                      <button
                        key={d}
                        className={`btn ${skillDir === d ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => pickDir(d)}
                      >
                        {DIR_LABEL[d]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* 散射放置流程明確化（需求）：提示列隨步驟切換文字；第 2 子選
                  定後停在「確認送出」而非自動送出；Esc／取消鈕可隨時退出。 */}
              {activeSkill === "SCATTER_SHOT" && (
                <div className="mt-8" data-testid="scatter-guide">
                  <p className="dim" style={{ fontSize: 13, marginBottom: 6, textAlign: "center" }}>
                    {!scatterFirst
                      ? "選擇第 1 個落點"
                      : !scatterSecond
                        ? "選擇第 2 個落點（紅色斜線區為禁區，需間隔 ≥ 2）"
                        : "確認送出這兩子？"}
                  </p>
                  {scatterFirst && scatterSecond ? (
                    <div className="row gap-8" style={{ justifyContent: "center" }}>
                      <button className="btn btn-primary" onClick={confirmScatterSubmit}>
                        確認送出
                      </button>
                      <button className="btn btn-ghost" onClick={clearSkillUi}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="row" style={{ justifyContent: "center" }}>
                      <button className="btn btn-ghost" onClick={clearSkillUi}>
                        取消散射
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <p className="dim center mt-8" style={{ fontSize: 13 }} aria-live="polite">
            輪到{turn === "BLACK" ? "黑" : "白"}方落子
          </p>
          {/* Bug fix: touchConfirm 模式下棋盤只設預覽游標，須靠外部按鈕呼叫 confirm()
              才會真的落子 — 手機（≤640px）先前缺這顆按鈕，導致永遠無法真正落子。 */}
          {touchConfirm && !isSpectator && !result && (
            <button
              className="btn btn-primary btn-block mt-8"
              disabled={!hasCursor}
              onClick={() => boardRef.current?.confirm()}
            >
              確認落子
            </button>
          )}
        </section>

        <aside className="sidebar">
          <div className="card pad">
            <h3 style={{ marginBottom: 10 }}>對局資訊</h3>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="dim">模式</span>
              <span>{duel ? "⚔️ 真劍勝負" : mode === "local" ? "本地雙人" : "線上連線"}</span>
            </div>
            {duel && (
              <>
                <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                  <span className="dim">場地</span>
                  <span>{duel.fieldType === "BEACH" ? "🏖️ 沙灘 16×16" : "🌋 火山 15×15"}</span>
                </div>
                {duel.fieldType === "BEACH" && (
                  <>
                    <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                      <span className="dim">漲潮</span>
                      <span>{tideTriggered ? `已觸發 · 已侵蝕 ${erodedRows} 排` : "未觸發"}</span>
                    </div>
                    <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                      <span className="dim">下次海浪</span>
                      <span className="num">{10 - (moveCount % 10)} 手後</span>
                    </div>
                  </>
                )}
                <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                  <span className="dim">黑方技能</span>
                  <span className="num">{usedSkills.BLACK.length}/3 已用</span>
                </div>
                <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                  <span className="dim">白方技能</span>
                  <span className="num">{usedSkills.WHITE.length}/3 已用</span>
                </div>
              </>
            )}
            <div className="row mt-8" style={{ justifyContent: "space-between" }}>
              <span className="dim">回合</span>
              <span>{turn === "BLACK" ? "黑方" : "白方"}</span>
            </div>
            <div className="row mt-8" style={{ justifyContent: "space-between" }}>
              <span className="dim">落子數</span>
              <span className="num">{moveCount}</span>
            </div>
          </div>
        </aside>
      </div>

      {showResult && (
        <Modal dismissable={false}>
          <div className="result-banner">
            {result === "DRAW" ? "和局" : `${winnerName} 獲勝！`}
          </div>
          {result === "DRAW" && (
            <p className="dim" style={{ textAlign: "center", marginTop: 6 }}>
              （含雙方同時斷線判和）
            </p>
          )}
          {/* 真劍勝負：結束畫面揭露所有隱藏格（需求 #44；沙灘/漲潮與火山/噴發皆涵蓋） */}
          {duel && (
            <p className="dim" style={{ textAlign: "center", marginTop: 6 }} data-testid="duel-reveal-note">
              {duel.fieldType === "BEACH"
                ? "🏖️ 沙灘場地 · 本局隱藏的漲潮格已全數揭露（🌊 標記）"
                : "🌋 火山場地 · 本局隱藏的噴發格已全數揭露（🌋 標記）"}
            </p>
          )}
          <div className="win-stat">
            <div>
              <div className="dim" style={{ fontSize: 12 }}>落子數</div>
              <b className="num">{moveCount}</b>
            </div>
            <div>
              <div className="dim" style={{ fontSize: 12 }}>耗時</div>
              <b className="num">{fmt(seconds)}</b>
            </div>
          </div>
          <div className="col gap-8 mt-16">
            {isSpectator ? (
              <p className="dim" style={{ textAlign: "center", fontSize: 13 }}>
                觀戰者僅顯示結果，無再戰／重新進局操作
              </p>
            ) : mode === "online" && isGuest ? (
              <>
                <Link className="btn btn-primary btn-block" href="/user#guest">
                  重新輸入暱稱進新局
                </Link>
                <div className="card pad" style={{ background: "#3a3018", borderColor: "#5a4a1e" }}>
                  <p style={{ fontSize: 13 }}>
                    💡 想保存戰績、登上排行榜？<b>強烈建議註冊一個帳號</b>
                  </p>
                  <Link className="btn btn-accent btn-block mt-8" href="/user">
                    立即註冊
                  </Link>
                </div>
              </>
            ) : (
              <RematchButton gameId={gameId} mode={mode} />
            )}
            <Link className="btn btn-ghost btn-block" href="/">
              {isSpectator ? "離開觀戰" : "回首頁"}
            </Link>
          </div>
        </Modal>
      )}

      {/* 真劍勝負：開局揭曉雙方職業（Q8 — 選擇階段互相隱藏，開局翻牌揭曉） */}
      {showReveal && duel && (
        <div className="duel-reveal" data-testid="duel-reveal" onClick={() => setShowReveal(false)}>
          {([["黑方", duel.blackClass], ["白方", duel.whiteClass]] as const).map(([who, cls]) => (
            <div key={who} className={`reveal-card${revealFlipped ? " show" : ""}`}>
              <div className="flip">
                <div className="face">❓ {who}</div>
                <div className="face back">
                  <span style={{ fontSize: 26 }}>{cls === "WARRIOR" ? "⚔️" : "🏹"}</span>
                  <span>{who} · {cls === "WARRIOR" ? "劍士" : "弓箭手"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showLeave && (
        <Modal onClose={() => setShowLeave(false)}>
          <h2 style={{ marginBottom: 10 }}>離開對局？</h2>
          <p className="dim" style={{ marginBottom: 16 }}>離開將結束目前對局。</p>
          <div className="col gap-8">
            <button className="btn btn-danger btn-block" onClick={leave}>
              確定離開
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setShowLeave(false)}>
              繼續對局
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/** Rematch (再戰) — 本地重置 / 線上重新開局 (需求 #12 #14). */
function RematchButton({ gameId, mode }: { gameId: string; mode: string }) {
  const router = useRouter();
  async function rematch() {
    try {
      const game = await gameService.rematch(gameId);
      router.push(`/game/${game.gameId}?mode=${mode}`);
    } catch (err) {
      if (!(err instanceof ApiError)) console.error("rematch failed", err);
      toast("無法發起再戰", "error");
    }
  }
  return (
    <button className="btn btn-primary btn-block" onClick={rematch}>
      再戰
    </button>
  );
}
