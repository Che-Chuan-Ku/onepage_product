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
  SkillType,
} from "@/lib/types/schemas";
import type { FieldCell, PlacedStone, RevealedCell, StoneColor } from "@/lib/game/GomokuBoard";
import { isUltimate, ultimateRect, wavePushDirection, type OceanSide } from "@/lib/game/duel";
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
const SKILL_INFO: Record<SkillType, { name: string; ico: string }> = {
  HORIZONTAL_SLASH: { name: "橫劈", ico: "⚔️" },
  VERTICAL_SLASH: { name: "縱劈", ico: "🗡️" },
  HEAVEN_EARTH_REVERSAL: { name: "天地反轉（大絕）", ico: "🌗" },
  PRECISION_SNIPE: { name: "精準狙擊", ico: "🎯" },
  SCATTER_SHOT: { name: "散射", ico: "🏹" },
  PIONEER_STAR: { name: "開拓之星（大絕）", ico: "💫" },
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
  const [previewCells, setPreviewCells] = useState<FieldCell[] | null>(null);
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
      // UI fix（對手施放技能提示）: this viewer has no local knowledge of
      // which skill the remote actor pressed — best-effort inference from
      // the settlement's own skillEvents (see inferSkillCast doc; known gap:
      // SCATTER_SHOT has no event signature and won't be announced here).
      if (state.skillEvents?.length) {
        const inferred = inferSkillCast(
          state.skillEvents,
          state.lastMove ? { row: state.lastMove.row, col: state.lastMove.col } : null,
        );
        if (inferred) announceSkillCast(actorColor, inferred);
      }
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
    setPreviewCells(null);
  }

  /** 真劍勝負：套用一次結算（落子 + 事件差分 + 特效 + 揭露 + 勝負）。 */
  const applyDuelState = useCallback(
    (
      state: GameStateResponse,
      ctx: { placed: Cell[]; actor: Color; slashDir: SkillDirection | null; skillType: SkillType | null },
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

  async function place(r: number, c: number) {
    if (isSpectator) {
      toast("觀戰中，無法落子", "error");
      return;
    }
    // ── 真劍勝負：依當前選取的技能組出 MoveCreateRequest（需求 #36）──
    if (duel) {
      const actor = turn;
      let req: MoveCreateRequest;
      const placed: Cell[] = [];
      let slashDir: SkillDirection | null = null;
      if (activeSkill && isUltimate(activeSkill)) {
        // 大絕：取代本回合落子；點擊格 = 錨點（必須空格，Q4 補充）
        if (!skillDir) {
          toast("請先選擇大絕方向", "error");
          return;
        }
        req = {
          skill: {
            skillType: activeSkill as "HEAVEN_EARTH_REVERSAL" | "PIONEER_STAR",
            direction: skillDir,
            anchor: { row: r, col: c },
          },
        };
      } else if (activeSkill === "PRECISION_SNIPE") {
        const clicked = stones.find((s) => s.r === r && s.c === c)?.color;
        if (clicked !== lc(actor === "BLACK" ? "WHITE" : "BLACK")) {
          toast("精準狙擊須點擊一顆現存的敵方棋子", "error");
          return;
        }
        req = { row: r, col: c, skill: { skillType: "PRECISION_SNIPE", target: { row: r, col: c } } };
      } else if (activeSkill === "SCATTER_SHOT") {
        if (!scatterFirst) {
          setScatterFirst({ row: r, col: c });
          toast("已選第 1 子，請點第 2 個空格（間隔 ≥ 2）");
          return;
        }
        if (Math.max(Math.abs(scatterFirst.row - r), Math.abs(scatterFirst.col - c)) < 2) {
          toast("散射兩子不得在彼此九宮格內（Chebyshev ≥ 2）", "error");
          return;
        }
        req = {
          row: scatterFirst.row,
          col: scatterFirst.col,
          skill: { skillType: "SCATTER_SHOT", secondStone: { row: r, col: c } },
        };
        placed.push(scatterFirst, { row: r, col: c });
      } else if (activeSkill === "HORIZONTAL_SLASH" || activeSkill === "VERTICAL_SLASH") {
        if (!skillDir) {
          toast("請先選擇劈砍方向", "error");
          return;
        }
        slashDir = skillDir;
        req = { row: r, col: c, skill: { skillType: activeSkill, direction: skillDir } };
        placed.push({ row: r, col: c });
      } else {
        req = { row: r, col: c };
        placed.push({ row: r, col: c });
      }
      try {
        const state = await gameService.placeMove(gameId, req);
        // MSW 無 STOMP 廣播 → 直接套用回應；真後端 online 模式仍走廣播
        if (mode !== "online" || USE_MOCKS)
          applyDuelState(state, { placed, actor, slashDir, skillType: activeSkill });
        if (activeSkill) {
          const s = activeSkill;
          setUsedSkills((prev) => ({ ...prev, [actor]: [...prev[actor], s] }));
        }
        clearSkillUi();
      } catch (err) {
        // non-ApiError（如回應 schema 不合的 ZodError）不應被 "落子不合法" toast
        // 蓋掉——那會讓 schema mismatch（伺服器其實已接受落子）誤判成業務錯誤。
        if (!(err instanceof ApiError)) console.error("placeMove (duel) failed", err);
        const msg = err instanceof ApiError ? err.message : "落子不合法";
        toast(msg, "error");
      }
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
    if (skill === "SCATTER_SHOT") toast("點擊兩個空格（Chebyshev 距離 ≥ 2）");
  }

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
            allowOccupied={!!duel && activeSkill === "PRECISION_SNIPE"}
            onPlace={place}
            onCursorChange={setHasCursor}
            onHover={handleHover}
            onBlocked={() =>
              toast(
                activeSkill && isUltimate(activeSkill) ? "大絕錨點必須是空格" : "該格為障礙物，禁止落子",
                "error",
              )
            }
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
                    <button
                      key={s}
                      className={`skill-btn${activeSkill === s ? " active" : ""}${used ? " used" : ""}`}
                      disabled={used || notMyTurn}
                      onClick={() => onSkillClick(s)}
                    >
                      {SKILL_INFO[s].ico} {SKILL_INFO[s].name}
                      {used ? "（已用）" : ""}
                    </button>
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
