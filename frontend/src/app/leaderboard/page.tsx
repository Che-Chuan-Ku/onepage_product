"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { playerService } from "@/lib/api/services";
import { useSession } from "@/lib/store/session";
import type { LeaderboardEntryResponse, PlayerStatsResponse } from "@/lib/types/schemas";
import { toast } from "@/lib/store/toast";

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const medal = ["", "🥇", "🥈", "🥉"];

/** Leaderboard + my stats — ports prototype/leaderboard (需求 #3, Q2 rule). */
export default function LeaderboardPage() {
  const playerId = useSession((s) => s.playerId) ?? "p-001";
  const [board, setBoard] = useState<LeaderboardEntryResponse[]>([]);
  const [stats, setStats] = useState<PlayerStatsResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [lb, st] = await Promise.all([
          playerService.leaderboard(),
          playerService.stats(playerId),
        ]);
        setBoard(lb.items);
        setStats(st);
      } catch {
        toast("無法載入排行榜", "error");
      }
    })();
  }, [playerId]);

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="layout">
          <section>
            <h1 style={{ fontSize: 24, marginBottom: 16 }}>排行榜</h1>
            <div className="card pad">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>名次</th>
                    <th>暱稱</th>
                    <th>勝場</th>
                    <th>勝率</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((r) => (
                    <tr key={r.playerId}>
                      <td className={`num ${r.rank <= 3 ? `rank-${r.rank}` : ""}`}>
                        {r.rank <= 3 ? medal[r.rank] : r.rank}
                      </td>
                      <td>{r.username}{r.playerId === playerId ? "（你）" : ""}</td>
                      <td className="num">{r.wins}</td>
                      <td className="num">{pct(r.winRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dim mt-16" style={{ fontSize: 13 }}>
                排序：勝場數 ↓，勝率 ↓（並列）。上榜門檻：累計 10 場對局。
              </p>
            </div>
          </section>

          <aside className="sidebar">
            <div className="card pad">
              <h3 style={{ marginBottom: 14 }}>我的戰績</h3>
              <div className="win-stat" style={{ margin: "0 0 8px" }}>
                <div>
                  <div className="dim" style={{ fontSize: 12 }}>勝場</div>
                  <b className="num">{stats?.wins ?? "—"}</b>
                </div>
                <div>
                  <div className="dim" style={{ fontSize: 12 }}>敗場</div>
                  <b className="num">{stats?.losses ?? "—"}</b>
                </div>
                <div>
                  <div className="dim" style={{ fontSize: 12 }}>勝率</div>
                  <b className="num">{stats ? pct(stats.winRate) : "—"}</b>
                </div>
              </div>
              <h4 className="dim mt-16" style={{ fontSize: 13 }}>最近對戰</h4>
              <div className="col gap-8 mt-8">
                {stats?.recentGames.map((m) => {
                  const win = m.result === "BLACK_WIN";
                  return (
                    <Link
                      key={m.gameId}
                      className="card pad row gap-8"
                      style={{ cursor: "pointer", textDecoration: "none" }}
                      href={`/replay/${m.gameId}`}
                    >
                      <span
                        className={`badge ${win ? "badge-ready" : "badge-wait"}`}
                        style={!win ? { background: "#3a1f19", color: "#ffd0c6" } : undefined}
                      >
                        {win ? "勝" : "負"}
                      </span>
                      <span className="grow" />
                      <span className="dim" style={{ fontSize: 12 }}>看回放 →</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
