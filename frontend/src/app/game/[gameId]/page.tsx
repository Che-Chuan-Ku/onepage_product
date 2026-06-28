"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Board } from "@/components/Board";
import { Modal } from "@/components/Modal";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { gameService } from "@/lib/api/services";
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
  const stompRef = useRef<StompClient | null>(null);

  const p1Name = mode === "local" ? "玩家一" : "阿哲";
  const p2Name = mode === "local" ? "玩家二" : "你";

  useEffect(() => {
    setTouchConfirm(typeof window !== "undefined" && window.matchMedia("(max-width:640px)").matches);
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

  // 載入對局初始狀態（Swap2 開局子 + 已落子 + 當前回合）。
  // 無 GET /games/{id} 端點 → 用 /replay 重建。需求 #30：開局後輪次依嚴格交替。
  // 對全新對局（0 子）保持預設（黑方先手）。online 晚進場者也能同步當前盤面。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const replay = await gameService.replay(gameId);
        if (cancelled) return;
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
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, mode]);

  const applyState = useCallback((state: GameStateResponse) => {
    if (state.lastMove) {
      setStones((prev) => [
        ...prev,
        { r: state.lastMove!.row, c: state.lastMove!.col, color: lc(state.lastMove!.color) },
      ]);
      setLastMove([state.lastMove.row, state.lastMove.col]);
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
            stones={stones}
            opening={openingStones}
            lastMove={lastMove}
            highlight={highlight}
            interactive={!isSpectator && !result}
            requireConfirm={touchConfirm}
            spectating={isSpectator}
            onPlace={place}
          />
          <p className="dim center mt-8" style={{ fontSize: 13 }} aria-live="polite">
            輪到{turn === "BLACK" ? "黑" : "白"}方落子
          </p>
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
