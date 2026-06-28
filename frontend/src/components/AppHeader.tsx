"use client";

import Link from "next/link";
import { useSession } from "@/lib/store/session";

/**
 * Global header with identity三態 (Q4). Ports prototype ui.js renderHeader:
 *   none       -> 註冊/登入 + 以訪客遊玩
 *   guest      -> 訪客 badge + 升級為註冊
 *   registered -> 戰績/排行榜 + avatar
 */
export function AppHeader() {
  const { identity, nickname } = useSession();
  const name = nickname || "KuPlayer";

  return (
    <header className="app-header">
      <Link className="logo" href="/">
        <span className="dot" />五子棋 Gomoku
      </Link>
      <div className="header-spacer" />
      <div className="identity">
        {identity === "none" && (
          <>
            <Link className="btn btn-ghost" href="/user">
              註冊 / 登入
            </Link>
            <Link className="btn btn-primary" href="/user#guest">
              以訪客遊玩
            </Link>
          </>
        )}
        {identity === "guest" && (
          <>
            <span className="badge badge-spec">訪客</span>
            <span>{name}</span>
            <Link className="btn btn-ghost" href="/user">
              升級為註冊
            </Link>
          </>
        )}
        {identity === "registered" && (
          <>
            <Link className="btn btn-ghost" href="/leaderboard">
              戰績 / 排行榜
            </Link>
            <span className="identity">
              <span className="avatar">{name[0] || "K"}</span>
              {name}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
