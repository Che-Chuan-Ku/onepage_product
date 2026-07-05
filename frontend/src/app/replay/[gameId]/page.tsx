"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Board } from "@/components/Board";
import { gameService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type { ClassType, GameReplayResponse, Color } from "@/lib/types/schemas";
import type { PlacedStone, StoneColor } from "@/lib/game/GomokuBoard";
import { beachSideFor, duelFieldMeta, duelSnapshots } from "@/lib/game/duelClient";
import { toast } from "@/lib/store/toast";

const lc = (c: Color): StoneColor => (c === "BLACK" ? "black" : "white");
const classLabel = (c: ClassType | null | undefined) =>
  c === "WARRIOR" ? "⚔️ 劍士" : c === "ARCHER" ? "🏹 弓箭手" : "—";

/** step captions for duel skill/field events (需求 #45 #47) */
const EVENT_LABEL: Record<string, string> = {
  VOLCANO_ERUPTED: "🌋 火山噴發",
  STONES_BURNED: "🔥 棋子燒毀",
  WAVE_SURGED: "🌊 海浪",
  TIDE_TRIGGERED: "🌊 漲潮觸發",
  TIDE_RISEN: "🌊 漲潮推進",
  SAND_ERODED: "🏖️ 沙灘侵蝕",
  STONE_PUSHED: "➡️ 推擠",
  STONE_REMOVED_OFF_BOARD: "🫧 推出棋盤",
  STONE_REPLACED: "🎯 精準狙擊",
  COLORS_SWAPPED: "🌗 天地反轉",
  STONES_CLEARED: "💫 開拓之星",
};

interface Step {
  r: number;
  c: number;
  color: StoneColor;
  opening: boolean;
}

/** Replay — ports prototype/replay (需求 #17 #32, opening stones gold-ringed). */
export default function ReplayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [replay, setReplay] = useState<GameReplayResponse | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    (async () => {
      try {
        setReplay(await gameService.replay(gameId));
      } catch (err) {
        if (!(err instanceof ApiError)) console.error("replay load failed", err);
        toast("無法載入回放", "error");
      }
    })();
  }, [gameId]);

  // ── 真劍勝負：以事件時間軸重建每一步盤面（推擠/燒毀/互換/侵蝕，需求 #47）──
  const isDuel = replay?.battleMode === "SERIOUS_DUEL" && !!replay.fieldType;
  const duelSteps = useMemo(
    () => (replay && isDuel ? duelSnapshots(replay) : []),
    [replay, isDuel],
  );
  const duelMeta = useMemo(() => {
    if (!replay || !isDuel) return null;
    // bug fix: same as the game page — the real backend's FIELD_GENERATED events
    // carry row=col=null, so fall back to the authoritative obstacles/seaSide
    // snapshot instead of (silently broken) inference from fieldEvents alone.
    const meta = duelFieldMeta(
      replay.fieldEvents,
      replay.fieldType!,
      replay.fieldType === "BEACH" ? 16 : 15,
      replay.seaSide ?? undefined,
    );
    return replay.obstacles ? { ...meta, obstacles: replay.obstacles } : meta;
  }, [replay, isDuel]);

  // flatten openingStones (by sequence) + moves (by moveNumber) into one timeline
  const steps: Step[] = useMemo(() => {
    if (!replay || isDuel) return [];
    const opening = [...replay.openingStones]
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => ({ r: s.row, c: s.col, color: lc(s.color), opening: true }));
    const moves = [...replay.moves]
      .sort((a, b) => a.moveNumber - b.moveNumber)
      .map((m) => ({ r: m.row, c: m.col, color: lc(m.color), opening: false }));
    return [...opening, ...moves];
  }, [replay, isDuel]);

  const total = isDuel ? Math.max(0, duelSteps.length - 1) : steps.length;

  useEffect(() => {
    if (!playing) {
      clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => {
      setIdx((i) => {
        if (i >= total) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 800);
    return () => clearInterval(timer.current);
  }, [playing, total]);

  // duel: board state comes from the reconstructed snapshot at `idx`
  const curDuel = isDuel ? duelSteps[Math.min(idx, duelSteps.length - 1)] : null;
  const shown = steps.slice(0, idx);
  const openingStones: PlacedStone[] = steps
    .filter((s) => s.opening)
    .map((s) => ({ r: s.r, c: s.c, color: s.color }));
  const stones: PlacedStone[] = curDuel
    ? curDuel.stones
    : shown.map((s) => ({ r: s.r, c: s.c, color: s.color }));
  const last: [number, number] | null = curDuel
    ? curDuel.move
      ? [curDuel.move.r, curDuel.move.c]
      : null
    : idx > 0
      ? ([steps[idx - 1].r, steps[idx - 1].c] as [number, number])
      : null;

  const togglePlay = () => {
    if (idx >= total) setIdx(0);
    setPlaying((p) => !p);
  };
  const step = (d: number) => setIdx((i) => Math.max(0, Math.min(total, i + d)));

  const winnerColor =
    replay?.result === "BLACK_WIN" ? "黑" : replay?.result === "WHITE_WIN" ? "白" : "—";
  const duelEvents = (curDuel?.eventTypes ?? [])
    .filter((t, i, arr) => t !== "FIELD_GENERATED" && arr.indexOf(t) === i)
    .map((t) => EVENT_LABEL[t] ?? t);
  const curLabel = isDuel
    ? idx > 0
      ? `第 ${idx} 手 · ${curDuel?.move ? (curDuel.move.color === "black" ? "黑" : "白") : "大絕"}${duelEvents.length ? ` · ${duelEvents.join(" ")}` : ""}`
      : "起始（場地生成）"
    : idx > 0
      ? `第 ${idx} 手 · ${steps[idx - 1].opening ? "開局子" : steps[idx - 1].color === "black" ? "黑" : "白"}`
      : "起始";

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="layout">
          <section>
            <Board
              stones={stones}
              opening={openingStones}
              lastMove={last}
              interactive={false}
              boardSize={isDuel && replay?.fieldType === "BEACH" ? 16 : 15}
              obstacles={isDuel && replay?.fieldType === "VOLCANO" ? duelMeta?.obstacles : undefined}
              beach={
                isDuel && replay?.fieldType === "BEACH" && duelMeta?.oceanSide
                  ? { side: beachSideFor(duelMeta.oceanSide), erodedRows: curDuel?.erodedRows ?? 0 }
                  : null
              }
              // 揭露格 kind 依事件/場地正確分支：沙灘漲潮 → TIDE（🌊）、
              // 火山噴發 → ERUPTION（🌋）——修正原型寫死 eruption 的缺陷
              revealedCells={curDuel?.revealed}
            />
            <div className="card pad mt-16">
              <div className="row gap-8">
                <button className="btn btn-ghost" onClick={() => step(-1)} aria-label="上一步">
                  ⏮ 上一步
                </button>
                <button className="btn btn-primary grow" onClick={togglePlay}>
                  {playing ? "⏸ 暫停" : "▶ 播放"}
                </button>
                <button className="btn btn-ghost" onClick={() => step(1)} aria-label="下一步">
                  下一步 ⏭
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={total}
                value={idx}
                style={{ width: "100%", marginTop: 14 }}
                onChange={(e) => setIdx(Number(e.target.value))}
                aria-label="回放進度"
              />
              <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                <span className="dim num">{idx} / {total}</span>
                <span className="dim">{curLabel}</span>
              </div>
            </div>
          </section>

          <aside className="sidebar">
            <div className="card pad">
              <h3 style={{ marginBottom: 12 }}>對局資訊</h3>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="dim">勝者</span>
                <span>{replay?.result === "DRAW" ? "和局" : `（${winnerColor}）`}</span>
              </div>
              <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                <span className="dim">落子數</span>
                <span className="num">{replay?.moveCount ?? "—"}</span>
              </div>
              <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                <span className="dim">開局</span>
                {isDuel ? (
                  <span className="badge badge-duel">⚔️ 真劍勝負</span>
                ) : replay?.useSwap2 ? (
                  <span className="badge badge-swap2">Swap2</span>
                ) : (
                  <span className="badge badge-normal">普通</span>
                )}
              </div>
              {isDuel && (
                <>
                  <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                    <span className="dim">場地</span>
                    <span>{replay?.fieldType === "BEACH" ? "🏖️ 沙灘 16×16" : "🌋 火山 15×15"}</span>
                  </div>
                  <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                    <span className="dim">黑方職業</span>
                    <span>{classLabel(replay?.blackClass)}</span>
                  </div>
                  <div className="row mt-8" style={{ justifyContent: "space-between" }}>
                    <span className="dim">白方職業</span>
                    <span>{classLabel(replay?.whiteClass)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="card pad">
              <p className="dim" style={{ fontSize: 13 }}>
                {isDuel
                  ? "技能與場地事件會隨時間軸重播；隱藏格（🌋 噴發／🌊 漲潮）於其觸發時點揭露。"
                  : "⭕ 帶金圈者為 Swap2 開局子（序列起始可識別並重播）。"}
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
