"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Board } from "@/components/Board";
import { gameService } from "@/lib/api/services";
import type { GameReplayResponse, Color } from "@/lib/types/schemas";
import type { PlacedStone, StoneColor } from "@/lib/game/GomokuBoard";
import { toast } from "@/lib/store/toast";

const lc = (c: Color): StoneColor => (c === "BLACK" ? "black" : "white");

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
      } catch {
        toast("無法載入回放", "error");
      }
    })();
  }, [gameId]);

  // flatten openingStones (by sequence) + moves (by moveNumber) into one timeline
  const steps: Step[] = useMemo(() => {
    if (!replay) return [];
    const opening = [...replay.openingStones]
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => ({ r: s.row, c: s.col, color: lc(s.color), opening: true }));
    const moves = [...replay.moves]
      .sort((a, b) => a.moveNumber - b.moveNumber)
      .map((m) => ({ r: m.row, c: m.col, color: lc(m.color), opening: false }));
    return [...opening, ...moves];
  }, [replay]);

  const total = steps.length;

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

  const shown = steps.slice(0, idx);
  const openingStones: PlacedStone[] = steps
    .filter((s) => s.opening)
    .map((s) => ({ r: s.r, c: s.c, color: s.color }));
  const stones: PlacedStone[] = shown.map((s) => ({ r: s.r, c: s.c, color: s.color }));
  const last = idx > 0 ? ([steps[idx - 1].r, steps[idx - 1].c] as [number, number]) : null;

  const togglePlay = () => {
    if (idx >= total) setIdx(0);
    setPlaying((p) => !p);
  };
  const step = (d: number) => setIdx((i) => Math.max(0, Math.min(total, i + d)));

  const winnerColor =
    replay?.result === "BLACK_WIN" ? "黑" : replay?.result === "WHITE_WIN" ? "白" : "—";
  const curLabel =
    idx > 0
      ? `第 ${idx} 手 · ${steps[idx - 1].opening ? "開局子" : steps[idx - 1].color === "black" ? "黑" : "白"}`
      : "起始";

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="layout">
          <section>
            <Board stones={stones} opening={openingStones} lastMove={last} interactive={false} />
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
                {replay?.useSwap2 ? (
                  <span className="badge badge-swap2">Swap2</span>
                ) : (
                  <span className="badge badge-normal">普通</span>
                )}
              </div>
            </div>
            <div className="card pad">
              <p className="dim" style={{ fontSize: 13 }}>
                ⭕ 帶金圈者為 Swap2 開局子（序列起始可識別並重播）。
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
