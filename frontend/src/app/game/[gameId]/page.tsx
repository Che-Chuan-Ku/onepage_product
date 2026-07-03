"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Board, type BoardHandle } from "@/components/Board";
import { Modal } from "@/components/Modal";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { gameService, roomService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type { GameStateResponse, Color } from "@/lib/types/schemas";
import type { PlacedStone, StoneColor } from "@/lib/game/GomokuBoard";
import { StompClient, type ConnState } from "@/lib/stomp/client";
import { channels } from "@/lib/stomp/channels";
import { useSession } from "@/lib/store/session";
import { toast } from "@/lib/store/toast";

const lc = (c: Color): StoneColor => (c === "BLACK" ? "black" : "white");
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Game board play — ports prototype/game (server-authoritative moves, win
 *  highlight, 4 result scenarios, reconnect, spectator read-only). */
export default function GamePage() {
  const params = useParams<{ gameId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const gameId = params.gameId;
  const mode = search.get("mode") || "local"; // local | online
  const isSpectator = search.get("role") === "spectator";
  const isGuest = useSession((s) => s.identity) === "guest";
  const myId = useSession((s) => s.playerId);

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
  const stompRef = useRef<StompClient | null>(null);
  const boardRef = useRef<BoardHandle>(null);
  const mountedRef = useRef(true);
  // 是否曾經成功連線過一次 —— 用來分辨「初次連線」與「斷線後重連成功」。
  const hasBeenOnlineRef = useRef(false);

  // Bug fix: online p1Name/p2Name used to be hardcoded placeholder strings.
  // Real nicknames + correct black/white mapping are resolved below once the
  // replay (which carries roomId/blackPlayerId/whitePlayerId) loads.
  const [p1Name, setP1Name] = useState(mode === "local" ? "玩家一" : "黑方");
  const [p2Name, setP2Name] = useState(mode === "local" ? "玩家二" : "白方");

  useEffect(() => {
    setTouchConfirm(typeof window !== "undefined" && window.matchMedia("(max-width:640px)").matches);
  }, []);

  useEffect(() => {
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
    client.subscribe<GameStateResponse>(channels.game(gameId), (state) => applyState(state));
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
        } catch {
          /* 查詢房間失敗 → 保留「黑方」/「白方」預設標籤 */
        }
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
    } catch {
      /* 全新局或 replay 不可用 → 保留預設 */
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

  async function place(r: number, c: number) {
    if (isSpectator) {
      toast("觀戰中，無法落子", "error");
      return;
    }
    try {
      const state = await gameService.placeMove(gameId, { row: r, col: c });
      // online: 後端會廣播到 /topic/game/{id}，雙方（含落子方）都由 STOMP applyState，
      // 此處不重複套用以免同一手疊兩次；本地無訂閱，直接套用。
      if (mode !== "online") applyState(state);
    } catch (err) {
      // InvalidMoveRejected (422) — show non-blocking toast (MoveToast)
      const msg = err instanceof ApiError ? err.message : "落子不合法";
      toast(msg, "error");
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
        </div>
        <div className={`player-chip${turn === "WHITE" ? " active" : ""}`}>
          <span className="stone-dot white" />
          <span>{p2Name}</span>
        </div>
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
            onPlace={place}
            onCursorChange={setHasCursor}
          />
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
              <span>{mode === "local" ? "本地雙人" : "線上連線"}</span>
            </div>
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
    } catch {
      toast("無法發起再戰", "error");
    }
  }
  return (
    <button className="btn btn-primary btn-block" onClick={rematch}>
      再戰
    </button>
  );
}
