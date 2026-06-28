"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { useSession } from "@/lib/store/session";
import { gameService } from "@/lib/api/services";
import { toast } from "@/lib/store/toast";

/** Home / mode select — ports prototype/home/index.html. */
export default function HomePage() {
  const router = useRouter();
  const identity = useSession((s) => s.identity);
  const [swap2, setSwap2] = useState(false);
  const [needIdentity, setNeedIdentity] = useState(false);
  const [busy, setBusy] = useState(false);

  async function goLocal() {
    if (busy) return;
    setBusy(true);
    try {
      const game = await gameService.startLocal({ useSwap2: swap2 });
      if (swap2) router.push(`/opening/${game.gameId}?ctx=local`);
      else router.push(`/game/${game.gameId}?mode=local`);
    } catch {
      toast("無法建立本地對局", "error");
      setBusy(false);
    }
  }

  function goOnline() {
    if (identity === "none") {
      setNeedIdentity(true);
    } else {
      router.push("/lobby");
    }
  }

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="center col" style={{ textAlign: "center", margin: "30px 0 36px" }}>
          <div style={{ fontSize: 14, color: "var(--c-text-dim)" }}>
            經典對弈 · 15×15 標準棋盤 · 支援 Swap2 公平開局
          </div>
          <h1 style={{ fontSize: 34, marginTop: 8 }}>選擇你的對戰方式</h1>
        </div>

        <div className="mode-grid">
          <button className="mode-card local" onClick={goLocal} disabled={busy}>
            <div className="ico">🪑</div>
            <h2>本地雙人</h2>
            <p className="dim">同一裝置輪流對弈，全功能、不需連線。</p>
            <label
              className="row gap-8"
              style={{ marginTop: 16, fontSize: 14 }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={swap2}
                onChange={(e) => setSwap2(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              啟用 Swap2 開局（更公平的開局規則）
            </label>
          </button>

          <button className="mode-card online" onClick={goOnline}>
            <div className="ico">🌐</div>
            <h2>線上連線</h2>
            <p className="dim">與其他玩家即時對戰、開房、快速配對與觀戰。</p>
            <div className="badge badge-normal" style={{ marginTop: 16 }}>
              需登入或以訪客身份
            </div>
          </button>
        </div>
      </main>

      {needIdentity && (
        <Modal onClose={() => setNeedIdentity(false)}>
          <h2 style={{ marginBottom: 8 }}>線上對戰需要身份</h2>
          <p className="dim" style={{ marginBottom: 18 }}>
            要登入，還是先以訪客玩一場？（訪客線上戰績不會保存）
          </p>
          <div className="col gap-8">
            <Link className="btn btn-accent btn-block" href="/user">
              登入 / 註冊
            </Link>
            <Link className="btn btn-primary btn-block" href="/user#guest">
              以訪客遊玩
            </Link>
            <button className="btn btn-ghost btn-block" onClick={() => setNeedIdentity(false)}>
              取消
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
