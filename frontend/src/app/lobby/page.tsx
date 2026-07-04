"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { roomService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type { FieldType, RoomListResponse, RoomVisibility } from "@/lib/types/schemas";
import { toast } from "@/lib/store/toast";

/** Room modes are mutually exclusive: SERIOUS_DUEL cannot combine with Swap2 (Q9). */
type RoomMode = "normal" | "swap2" | "duel";

/** Lobby — public rooms, create, join-by-code, quick match (需求 #5 #6). */
export default function LobbyPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomListResponse[]>([]);
  const [code, setCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [visibility, setVisibility] = useState<RoomVisibility>("PUBLIC");
  const [roomMode, setRoomMode] = useState<RoomMode>("normal");
  const [fieldType, setFieldType] = useState<FieldType>("VOLCANO");
  const [matching, setMatching] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const qmTimer = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    try {
      const page = await roomService.listPublic();
      setRooms(page.items);
    } catch {
      toast("無法載入房間列表", "error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function enter(room: RoomListResponse) {
    try {
      const detail = await roomService.join(room.roomId);
      if (detail.joinedAsRole === "SPECTATOR") {
        toast("對戰席已滿，已以觀戰者身份進入", "success");
        setTimeout(() => router.push(`/room/${detail.roomId}?role=spectator`), 600);
      } else {
        router.push(`/room/${detail.roomId}`);
      }
    } catch {
      toast("加入房間失敗", "error");
    }
  }

  async function joinByCode() {
    const c = code.trim().toUpperCase();
    if (!c) {
      toast("請輸入房間碼", "error");
      return;
    }
    const room = rooms.find((r) => r.roomCode === c);
    if (!room) {
      toast("房間不存在，請確認房間碼", "error");
      return;
    }
    enter(room);
  }

  async function createRoom() {
    try {
      const detail = await roomService.create({
        visibility,
        isSwap2Mode: roomMode === "swap2",
        battleMode: roomMode === "duel" ? "SERIOUS_DUEL" : "NORMAL",
        // fieldType is duel-only; must stay unset otherwise (api.yml 422)
        ...(roomMode === "duel" ? { fieldType } : {}),
      });
      setShowCreate(false);
      router.push(`/room/${detail.roomId}`);
    } catch (err) {
      // 422002 = duel parameter conflict (Swap2 mutex / missing fieldType)
      toast(err instanceof ApiError ? err.message : "建立房間失敗", "error");
    }
  }

  async function quickMatch() {
    setMatching(true);
    setCountdown(60);
    try {
      const res = await roomService.quickMatch();
      if (res.matched && res.roomId) {
        toast("配對成功！", "success");
        setTimeout(() => router.push(`/room/${res.roomId}`), 600);
        return;
      }
      // queued: count down 60s (Q6) — backend WS would notify; demo timer
      qmTimer.current = setInterval(() => {
        setCountdown((s) => {
          if (s <= 1) {
            clearInterval(qmTimer.current);
            setMatching(false);
            toast("排隊過久，請重新開始配對", "error");
            return 60;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setMatching(false);
      toast("配對失敗", "error");
    }
  }

  function cancelQM() {
    clearInterval(qmTimer.current);
    setMatching(false);
    toast("已退出配對佇列");
  }

  useEffect(() => () => clearInterval(qmTimer.current), []);

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="layout">
          <section>
            <div className="row gap-12 wrap" style={{ marginBottom: 18 }}>
              <h1 style={{ fontSize: 24 }}>公開房間</h1>
              <span className="grow" />
              <button className="btn btn-ghost" onClick={() => { load(); toast("房間列表已更新"); }}>
                ↻ 重新整理
              </button>
            </div>
            <div className="col gap-12">
              {rooms.map((r) => (
                <div key={r.roomId} className="card pad row gap-16 wrap">
                  <div>
                    <div className="dim" style={{ fontSize: 12 }}>房間碼</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{r.roomCode}</div>
                  </div>
                  <div>
                    <div className="dim" style={{ fontSize: 12 }}>房主</div>
                    <div>{r.hostNickname}</div>
                  </div>
                  <div>
                    <div className="dim" style={{ fontSize: 12 }}>對戰</div>
                    <div className="num">{r.playerCount}/2</div>
                  </div>
                  <div>
                    <div className="dim" style={{ fontSize: 12 }}>觀戰</div>
                    <div className="num">{r.spectatorCount} 人</div>
                  </div>
                  {r.battleMode === "SERIOUS_DUEL" ? (
                    <span className="badge badge-duel">
                      ⚔️ 真劍勝負 {r.fieldType === "BEACH" ? "🏖️ 沙灘" : "🌋 火山"}
                    </span>
                  ) : (
                    <span className={`badge ${r.isSwap2Mode ? "badge-swap2" : "badge-normal"}`}>
                      {r.isSwap2Mode ? "Swap2" : "普通"}
                    </span>
                  )}
                  <span className="grow" />
                  <button
                    className={`btn ${r.playerCount >= 2 ? "btn-ghost" : "btn-primary"}`}
                    onClick={() => enter(r)}
                  >
                    {r.playerCount >= 2 ? "觀戰" : "加入"}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <aside className="sidebar">
            <div className="card pad">
              <h3 style={{ marginBottom: 12 }}>建立房間</h3>
              <button className="btn btn-primary btn-block" onClick={() => setShowCreate(true)}>
                ＋ 建立房間
              </button>
            </div>
            <div className="card pad">
              <h3 style={{ marginBottom: 12 }}>輸入房間碼加入</h3>
              <div className="row gap-8">
                <input
                  className="input grow"
                  placeholder="房間碼 如 7F3K"
                  maxLength={6}
                  style={{ textTransform: "uppercase" }}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button className="btn btn-accent" onClick={joinByCode}>加入</button>
              </div>
            </div>
            <div className="card pad">
              <h3 style={{ marginBottom: 12 }}>快速配對</h3>
              <button className="btn btn-accent btn-block" onClick={quickMatch}>⚡ 快速配對</button>
            </div>
          </aside>
        </div>
      </main>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <h2 style={{ marginBottom: 14 }}>建立房間</h2>
          <div className="field">
            <label>可見性</label>
            <div className="tabs">
              {(["PUBLIC", "PRIVATE"] as RoomVisibility[]).map((v) => (
                <div key={v} className={`tab${visibility === v ? " active" : ""}`} onClick={() => setVisibility(v)}>
                  {v === "PUBLIC" ? "公開" : "私人"}
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>房間模式</label>
            {/* 三選一互斥：真劍勝負與 Swap2 不可同時（Q9） */}
            <div className="tabs">
              <div className={`tab${roomMode === "normal" ? " active" : ""}`} onClick={() => setRoomMode("normal")}>普通</div>
              <div className={`tab${roomMode === "swap2" ? " active" : ""}`} onClick={() => setRoomMode("swap2")}>Swap2</div>
              <div className={`tab${roomMode === "duel" ? " active" : ""}`} onClick={() => setRoomMode("duel")}>⚔️ 真劍勝負</div>
            </div>
          </div>
          {roomMode === "duel" && (
            <div className="field" data-testid="field-picker">
              <label>場地（真劍勝負必選，需求 #34）</label>
              <div className="tabs">
                <div className={`tab${fieldType === "VOLCANO" ? " active" : ""}`} onClick={() => setFieldType("VOLCANO")}>🌋 火山 15×15</div>
                <div className={`tab${fieldType === "BEACH" ? " active" : ""}`} onClick={() => setFieldType("BEACH")}>🏖️ 沙灘 16×16</div>
              </div>
            </div>
          )}
          <button className="btn btn-primary btn-block mt-8" onClick={createRoom}>
            建立並進入房間
          </button>
        </Modal>
      )}

      {matching && (
        <Modal dismissable={false}>
          <div className="center col" style={{ textAlign: "center" }}>
            <div className="coin-scene center">
              <div style={{ fontSize: 50, animation: "pulse 1.2s infinite" }}>⚡</div>
            </div>
            <h2 className="mt-16">配對中…</h2>
            <p className="dim">
              正在為你尋找對手 · <span className="num">{countdown}</span>s
            </p>
            <button className="btn btn-ghost mt-16" onClick={cancelQM}>取消配對</button>
          </div>
        </Modal>
      )}
    </>
  );
}
