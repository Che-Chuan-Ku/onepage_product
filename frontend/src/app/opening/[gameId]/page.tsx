"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Board, type BoardHandle } from "@/components/Board";
import { Modal } from "@/components/Modal";
import { gameService } from "@/lib/api/services";
import type { Color, Swap2Choice, GameStateResponse } from "@/lib/types/schemas";
import type { PlacedStone, StoneColor } from "@/lib/game/GomokuBoard";
import { StompClient } from "@/lib/stomp/client";
import { channels } from "@/lib/stomp/channels";
import { useSession } from "@/lib/store/session";
import { toast } from "@/lib/store/toast";

// waitChoice：線上假先方放完三子後，等假後方選擇（訂閱 game 頻道偵測 PLAYING）
type Phase = "tutorial" | "coin" | "place" | "wait" | "choice" | "waitChoice";

// 標準 Swap2 開局子配色（嚴格「黑·白·黑」；放第四五子時續「白·黑」）—— 需求 #24/#30
// index 0..4 = BLACK,WHITE,BLACK,WHITE,BLACK，與後端 Swap2Phase.expectedColor 一致
const SEQ: Color[] = ["BLACK", "WHITE", "BLACK", "WHITE", "BLACK"];
const lc = (c: Color): StoneColor => (c === "BLACK" ? "black" : "white");
const TUT_KEY = "gmk_swap2_tut";

/** Swap2 opening flow — ports prototype/opening (需求 #28 #31, tutorial/coin/place/choice). */
export default function OpeningPage() {
  const params = useParams<{ gameId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const gameId = params.gameId;
  const ctx = search.get("ctx") || "online";
  const isOnline = ctx === "online";
  const myId = useSession((s) => s.playerId);
  // 線上：start-game 已指派假先方，透過 URL ?tf= 帶入（room 頁 GameStarted）
  const tfParam = search.get("tf");
  const amFirst = isOnline ? !!myId && myId === tfParam : true;

  const [phase, setPhase] = useState<Phase>("tutorial");
  const [stones, setStones] = useState<PlacedStone[]>([]);
  const [noShow, setNoShow] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [coinResult, setCoinResult] = useState<0 | 180>(0); // rotateY deg
  const [youFirst, setYouFirst] = useState(true);
  const [hasCursor, setHasCursor] = useState(false);
  // 假後方選「放第四、五子」後進入二階段：續放第 4、5 子，選色權轉回假先方（需求 #29/#30）
  const [secondStage, setSecondStage] = useState(false);
  const boardRef = useRef<BoardHandle>(null);

  // 本階段需放到第幾子（一階段 3 子；二階段 5 子）
  const target = secondStage ? 5 : 3;

  const placedColor = (i: number) => SEQ[i] ?? "BLACK";

  // 教學後的下一階段：線上跳過投幣（start-game 已決定假先方），依角色進 place/wait
  const afterTutorialPhase = (): Phase =>
    isOnline ? (amFirst ? "place" : "wait") : "coin";

  // entry: respect "不再顯示" tutorial preference
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(TUT_KEY)) {
      setPhase(afterTutorialPhase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, amFirst]);

  const closeTutorial = () => {
    if (noShow) localStorage.setItem(TUT_KEY, "1");
    setPhase(afterTutorialPhase());
  };

  const toss = useCallback(async () => {
    setFlipping(true);
    try {
      const res = await gameService.tossCoin(gameId);
      // 本地單機：同一人輪流扮演假先方與假後方 → 玩家即假先方，放真子（需求 #25）。
      // 線上：依後端指派的 tentativeFirstPlayerId 判定自己是否為假先方。
      const first = ctx === "local" ? true : res.tentativeFirstPlayerId != null;
      setYouFirst(first);
      setCoinResult(first ? 0 : 180);
    } catch {
      toast("投擲硬幣失敗", "error");
    }
    setTimeout(() => {
      toast(youFirstRef.current ? "你是假先方" : "你是假後方", "success");
      setTimeout(() => setPhase(youFirstRef.current ? "place" : "wait"), 600);
    }, 1600);
  }, [gameId]);

  // keep latest youFirst for the timeout closure
  const youFirstRef = useRef(youFirst);
  youFirstRef.current = youFirst;

  // 線上假後方（wait）：訂閱 /topic/game/{id}/opening，每次廣播 fetch replay 重建對手開局子。
  //   廣播 payload 不含 stones，故以 replay 取真實 openingStones（複用現成端點）。
  //   放滿三子 → 進入選擇階段。
  useEffect(() => {
    if (phase !== "wait" || !isOnline) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const replay = await gameService.replay(gameId);
        if (cancelled) return;
        const opening = [...replay.openingStones]
          .sort((a, b) => a.sequence - b.sequence)
          .map((s) => ({ r: s.row, c: s.col, color: lc(s.color) }));
        setStones(opening);
        if (opening.length >= 3) setPhase("choice");
      } catch {
        /* ignore */
      }
    };
    const client = new StompClient();
    client.connect();
    client.subscribe(channels.gameOpening(gameId), () => void refresh());
    void refresh(); // 初始拉一次（可能已有子）
    return () => {
      cancelled = true;
      client.disconnect();
    };
  }, [phase, isOnline, gameId]);

  // 線上假先方：盡早(放置階段即)訂閱 game 頻道並持續，待對手選色定案(status PLAYING) → 進對局。
  //   提早訂閱避免「假後方選得快、假先方剛進 waitChoice 尚未訂閱」而漏接 PLAYING 廣播。
  useEffect(() => {
    if (!isOnline || !amFirst) return;
    const client = new StompClient();
    client.connect();
    client.subscribe<GameStateResponse>(channels.game(gameId), (state) => {
      if (state.status === "PLAYING") {
        toast("對手已選色，進入正式對局", "success");
        setTimeout(() => router.push(`/game/${gameId}?mode=online&from=swap2`), 600);
      }
    });
    return () => client.disconnect();
  }, [isOnline, amFirst, gameId, router]);

  async function placeStone(r: number, c: number) {
    const color = placedColor(stones.length);
    try {
      await gameService.placeOpeningStone(gameId, { row: r, col: c, color });
      const next = [...stones, { r, c, color: lc(color) }];
      setStones(next);
      // 完成本階段放置後自動推進（spec：不靠手動按鈕）：
      //  - 本地：同一人接著扮假後方 → choice
      //  - 線上假先方：交給對手選擇 → waitChoice（訂閱 game 偵測 PLAYING）
      if (next.length >= target) {
        if (isOnline && !secondStage) {
          setTimeout(() => setPhase("waitChoice"), 300);
        } else {
          setTimeout(() => setPhase("choice"), 300);
        }
      }
    } catch {
      toast("無法放置開局子", "error");
    }
  }

  async function undo() {
    try {
      await gameService.undoLastOpeningStone(gameId);
      setStones((s) => s.slice(0, -1));
      boardRef.current?.clearCursor();
      toast("已悔最後一子");
    } catch {
      toast("無法悔子", "error");
    }
  }

  async function choose(choice: Swap2Choice, label: string) {
    try {
      const res = await gameService.makeSwap2Choice(gameId, { choice });
      // 後端回傳 status 決定後續：PLAYING=顏色定案進對局；OPENING=放第四五子二階段（需求 #30）
      if (res.status === "PLAYING") {
        toast(`已選擇：${label} · 顏色定案，進入正式對局`, "success");
        const mode = ctx === "local" ? "local" : "online";
        setTimeout(() => router.push(`/game/${gameId}?mode=${mode}&from=swap2`), 900);
      } else {
        // PLACE_TWO_MORE：換手續放第四、五子，選色權之後轉回假先方
        toast("換手放第四、五子，之後由假先方選色", "success");
        setSecondStage(true);
        setPhase("place");
        boardRef.current?.clearCursor();
      }
    } catch {
      toast("無法送出選擇", "error");
    }
  }

  const n = stones.length;
  const placing = phase === "place" && n < target;

  return (
    <main className="page">
      <div className="info-bar" style={{ marginBottom: 14 }} aria-live="polite">
        <span className="badge badge-swap2">Swap2 開局</span>
        <b>
          {phase === "coin" && "投擲硬幣，決定假先方…"}
          {phase === "place" && (secondStage ? "放置第四、五子" : "你是假先方 — 放置開局子")}
          {phase === "wait" && "你是假後方 — 等待對手開局…"}
          {phase === "waitChoice" && "你是假先方 — 等待對手選擇…"}
          {phase === "choice" && (secondStage ? "假先方選色（執黑 / 執白）" : "假後方三選一")}
          {phase === "tutorial" && "準備投擲硬幣…"}
        </b>
        <span className="grow" />
        <span className="dim">{placing ? `${n}/${target}` : ""}</span>
      </div>

      <div className="layout">
        <section>
          <Board
            ref={boardRef}
            stones={stones}
            opening={stones}
            interactive={placing}
            requireConfirm
            onPlace={placeStone}
            onCursorChange={setHasCursor}
          />
        </section>

        <aside className="sidebar">
          <div className="card pad">
            {phase === "coin" && (
              <div className="center col" style={{ textAlign: "center" }}>
                <div className="coin-scene">
                  <motion.div
                    className="coin"
                    animate={
                      flipping
                        ? { rotateX: [0, 1980], rotateY: coinResult }
                        : { rotateY: coinResult }
                    }
                    transition={{ duration: 1.6, ease: [0.3, 0.1, 0.2, 1] }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div className="face heads">先</div>
                    <div className="face tails">後</div>
                  </motion.div>
                </div>
                <button className="btn btn-primary mt-16" disabled={flipping} onClick={toss}>
                  投擲硬幣
                </button>
              </div>
            )}

            {phase === "place" && n < target && (
              <>
                <h3 style={{ marginBottom: 8 }}>
                  {secondStage ? "放置第四、五子" : "放置開局子"}（{n}/{target}）
                </h3>
                <p className="dim" style={{ marginBottom: 14 }}>
                  點擊盤面預覽，下一子為 <b>{placedColor(n) === "BLACK" ? "黑" : "白"}</b>。
                  {n + 1 >= target ? "（放完自動進入選擇）" : ""}
                </p>
                <button
                  className="btn btn-primary btn-block"
                  disabled={!hasCursor}
                  onClick={() => boardRef.current?.confirm()}
                >
                  確認此子
                </button>
                <button
                  className="btn btn-ghost btn-block mt-8"
                  disabled={n === 0 || (secondStage && n <= 3)}
                  onClick={undo}
                >
                  悔最後一子
                </button>
              </>
            )}

            {phase === "wait" && (
              <div className="center col" style={{ textAlign: "center", padding: "14px 0" }}>
                <div style={{ fontSize: 40, animation: "pulse 1.4s infinite" }}>⌛</div>
                <p className="dim mt-8">等待對手放置開局子</p>
              </div>
            )}

            {phase === "waitChoice" && (
              <div className="center col" style={{ textAlign: "center", padding: "14px 0" }}>
                <div style={{ fontSize: 40, animation: "pulse 1.4s infinite" }}>⌛</div>
                <p className="dim mt-8">已完成三子，等待對手選色…</p>
              </div>
            )}

            {phase === "choice" && (
              <>
                <h3 style={{ marginBottom: 12 }}>
                  {secondStage ? "假先方選色" : "選擇你的接手方式"}
                </h3>
                <div className="col gap-12">
                  <div className="opt-card" onClick={() => choose("TAKE_BLACK", "執黑")}>
                    <h3>執黑</h3>
                    <p>接手目前盤面以黑棋繼續</p>
                  </div>
                  <div className="opt-card" onClick={() => choose("TAKE_WHITE", "執白")}>
                    <h3>執白</h3>
                    <p>接手目前盤面以白棋繼續</p>
                  </div>
                  {/* 放第四、五子僅一階段（假後方）可選；二階段假先方只能選色 */}
                  {!secondStage && (
                    <div className="opt-card" onClick={() => choose("PLACE_TWO_MORE", "放第四五子")}>
                      <h3>放第四、五子</h3>
                      <p>再交由對手選色</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {phase === "tutorial" && <div className="center col" style={{ padding: "10px 0" }}><div className="dim">載入中…</div></div>}
          </div>

          <div className="card pad">
            <button className="btn btn-ghost btn-block" onClick={() => setPhase("tutorial")}>
              ？ Swap2 規則說明
            </button>
          </div>
        </aside>
      </div>

      {phase === "tutorial" && (
        <Modal dismissable onClose={closeTutorial}>
          <h2 style={{ marginBottom: 10 }}>Swap2 開局怎麼玩？</h2>
          <p className="dim" style={{ lineHeight: 1.7 }}>
            假先方先在盤面放 <b>3 顆子（黑·白·黑）</b>，假後方再從三個選項中選擇：<br />
            ① 執黑接手 ② 執白接手 ③ 再放第四、五子後交由對手選色。<br />
            讓開局更公平，避免先手優勢過大。
          </p>
          <label className="row gap-8 mt-16" style={{ fontSize: 14 }}>
            <input
              type="checkbox"
              checked={noShow}
              onChange={(e) => setNoShow(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            不再顯示
          </label>
          <button className="btn btn-primary btn-block mt-16" onClick={closeTutorial}>
            我知道了
          </button>
        </Modal>
      )}
    </main>
  );
}
