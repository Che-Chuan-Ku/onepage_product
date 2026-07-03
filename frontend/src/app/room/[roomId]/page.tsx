"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { roomService } from "@/lib/api/services";
import type { RoomMemberItem } from "@/lib/types/schemas";
import { StompClient, type ConnState } from "@/lib/stomp/client";
import { channels } from "@/lib/stomp/channels";
import { useSession } from "@/lib/store/session";
import { toast } from "@/lib/store/toast";

interface ChatMsg {
  who: string;
  text: string;
}

/** Room — real members + Ready→start-game + STOMP chat (需求 #7 #26, Q5). */
export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId;

  const myId = useSession((s) => s.playerId);
  const myNick = useSession((s) => s.nickname);

  const [members, setMembers] = useState<RoomMemberItem[]>([]);
  const [status, setStatus] = useState<string>("WAITING");
  const [roomCode, setRoomCode] = useState<string>("");
  const [hostId, setHostId] = useState<string | null>(null);
  const startingRef = useRef(false);
  const [conn, setConn] = useState<ConnState>("offline");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatIn, setChatIn] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const stompRef = useRef<StompClient | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const navigatedRef = useRef(false);

  // Bug fix: slot 0/1 (黑/白) must reflect the real host/guest, not raw array
  // order — the backend now returns members ordered by join time (host first),
  // but we additionally sort by hostId here so a stale/unordered payload can't
  // flip black/white on the room screen.
  const players = [...members.filter((m) => m.role === "PLAYER")].sort((a, b) => {
    if (a.playerId === hostId) return -1;
    if (b.playerId === hostId) return 1;
    return 0;
  });
  const spectators = members.filter((m) => m.role === "SPECTATOR");
  const me = members.find((m) => m.playerId === myId);
  const isSpectator = me?.role === "SPECTATOR" || search.get("role") === "spectator";
  const iAmReady = !!me?.isReady;

  // 導航到對局/開局（去重）。線上 Swap2 帶 tf=假先方 id 供 opening 頁判角色。
  function goToGame(gameId: string, useSwap2: boolean, tentativeFirstPlayerId?: string | null) {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const dest = useSwap2
      ? `/opening/${gameId}?ctx=online${tentativeFirstPlayerId ? `&tf=${tentativeFirstPlayerId}` : ""}`
      : `/game/${gameId}?mode=online`;
    setTimeout(() => router.push(dest), 400);
  }

  // 房間達 READY → 呼叫 start-game（冪等；後端悲觀鎖序列化並發呼叫）。
  // 導航統一由 GameStarted 廣播觸發（含 tentativeFirstPlayerId），雙方拿同一資料。
  async function ensureStartAndGo() {
    if (navigatedRef.current || startingRef.current) return;
    startingRef.current = true;
    try {
      // response 直接帶 gameId + tentativeFirstPlayerId → 立即導航（可靠，不依賴廣播時序）；
      // 對手由 GameStarted 廣播導航。navigatedRef 去重。
      const g = await roomService.startGame(roomId);
      goToGame(g.gameId, g.useSwap2, g.tentativeFirstPlayerId ?? null);
    } catch {
      startingRef.current = false;
      toast("無法開始對局", "error");
    }
  }

  // 初始載入房間快照（真成員）
  useEffect(() => {
    (async () => {
      try {
        const d = await roomService.get(roomId);
        setMembers(d.members);
        setStatus(d.status);
        setRoomCode(d.roomCode);
        setHostId(d.hostPlayerId ?? null);
      } catch {
        /* 進房失敗：保持空，STOMP 廣播會補 */
      }
    })();
  }, [roomId]);

  // 線上即時房間頻道：成員更新 / GameStarted / 聊天（需求 #7 #16）
  useEffect(() => {
    const client = new StompClient();
    client.onState = setConn;
    client.connect();
    client.subscribe<Record<string, unknown>>(channels.room(roomId), (msg) => {
      if (!msg || typeof msg !== "object") return;
      // GameStarted：start-game 後廣播，雙方收到同一 gameId（+ Swap2 的假先方 id）
      if (typeof msg.gameId === "string") {
        goToGame(
          msg.gameId as string,
          !!msg.useSwap2,
          typeof msg.tentativeFirstPlayerId === "string" ? (msg.tentativeFirstPlayerId as string) : null,
        );
        return;
      }
      // 房間明細更新（成員/狀態）→ 只更新 state；start-game 由下方反應式 effect 觸發
      if (Array.isArray(msg.members)) {
        setMembers(msg.members as RoomMemberItem[]);
        if (typeof msg.hostPlayerId === "string") setHostId(msg.hostPlayerId as string);
        if (typeof msg.status === "string") setStatus(msg.status as string);
        return;
      }
      // 聊天：忽略自己的回音（who===myNick 已樂觀顯示）
      if (msg.type === "chat" && typeof msg.text === "string") {
        if (msg.who !== myNick) {
          setChat((c) => [...c, { who: String(msg.who ?? "對手"), text: String(msg.text) }]);
        }
      }
    });
    stompRef.current = client;
    return () => client.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [chat]);

  // 反應式觸發：房間達 READY → 開始對局（用最新的 status/hostId/myId，免閉包過期）。
  // 註：程式碼實際上不論房主或訪客都會呼叫 ensureStartAndGo，兩邊都觸發是刻意設計——
  // 對應後端 RoomService.startOnlineGame 的悲觀鎖 + 冪等回傳（見該檔註解：允許雙方併發
  // 呼叫並收斂到同一個 gameId），藉此避免「若只由房主觸發、房主端剛好卡住」時對局卡死。
  // hostId 目前只用來讓「稍後才拿到 hostId/myId」時能重新觸發本 effect，不是身份門檻。
  useEffect(() => {
    if (status === "READY") void ensureStartAndGo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, hostId, myId]);

  function copyCode() {
    const code = roomCode || roomId;
    navigator.clipboard?.writeText(code);
    toast(`房間碼已複製：${code}`, "success");
  }

  async function toggleReady() {
    try {
      const detail = await roomService.toggleReady(roomId);
      setMembers(detail.members);
      setStatus(detail.status);
      if (detail.hostPlayerId) setHostId(detail.hostPlayerId);
      if (detail.status === "READY") toast("雙方皆已準備，進入開局…", "success");
      // start-game 由反應式 effect 觸發（依最新 status/hostId/myId）
    } catch {
      toast("無法切換準備狀態", "error");
    }
  }

  function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = chatIn.trim();
    if (!v) return;
    const who = myNick || "你";
    setChat((c) => [...c, { who, text: v }]); // 樂觀顯示
    setChatIn("");
    stompRef.current?.send(channels.room(roomId), { type: "chat", who, text: v });
  }

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="row gap-12 wrap" style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22 }}>房間</h1>
          <button
            className="badge badge-normal"
            onClick={copyCode}
            style={{ cursor: "pointer", border: "none" }}
          >
            房間碼：{roomCode || "…"}（點擊複製）
          </button>
          <span className="grow" />
          <ConnectionBadge state={conn} />
        </div>

        <div className="layout">
          <section className="col gap-16">
            <div className="card pad">
              <h3 style={{ marginBottom: 12 }}>對戰席</h3>
              <div className="col gap-12">
                {[0, 1].map((slot) => {
                  const p = players[slot];
                  const dot = slot === 0 ? "black" : "white";
                  return (
                    <div
                      key={slot}
                      className="row gap-12 card pad"
                      style={{ background: "var(--c-surface-2)" }}
                    >
                      <span
                        className={`stone-dot ${dot}`}
                        style={{ width: 22, height: 22, borderRadius: "50%" }}
                      />
                      <b>{p ? p.nickname : "（空位 — 等待對手）"}</b>
                      {p && p.playerId === hostId && <span className="dim">（房主）</span>}
                      <span className="grow" />
                      {p && (
                        <span className={`badge ${p.isReady ? "badge-ready" : "badge-wait"}`}>
                          {p.isReady ? "已準備" : "未準備"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {!isSpectator && (
                <button className="btn btn-success btn-block mt-16" onClick={toggleReady}>
                  {iAmReady ? "取消 Ready" : "標記 Ready"}
                </button>
              )}
              <p className="dim mt-8" style={{ fontSize: 13, textAlign: "center" }}>
                {isSpectator
                  ? "你以觀戰者身份在此房間（唯讀，可聊天）"
                  : "雙方皆 Ready 後自動進入開局"}
              </p>
            </div>

            <div className="card pad">
              <div className="row gap-8" style={{ marginBottom: 10 }}>
                <h3>觀戰席</h3>
                <span className="badge badge-spec">觀戰中 {spectators.length} 人</span>
              </div>
              <div className="dim" style={{ fontSize: 14 }}>
                {spectators.length ? spectators.map((s) => s.nickname).join(" · ") : "（無觀戰者）"}
              </div>
            </div>
          </section>

          <aside className="sidebar">
            <div className="card pad">
              <div className="row" style={{ marginBottom: 8 }}>
                <h3>即時聊天</h3>
                <span className="grow" />
                <button
                  className="btn btn-ghost collapse-toggle"
                  onClick={() => setCollapsed((c) => !c)}
                  style={{ minHeight: 32, padding: "0 12px" }}
                >
                  {collapsed ? "展開" : "收合"}
                </button>
              </div>
              <div className={`chat collapsible${collapsed ? " collapsed" : ""}`}>
                <div className="chat-msgs" ref={msgsRef}>
                  {chat.map((m, i) => (
                    <div className="chat-msg" key={i}>
                      <span className="who">{m.who}</span>
                      {m.text}
                    </div>
                  ))}
                </div>
                <form className="chat-input" onSubmit={send}>
                  <input
                    className="input grow"
                    placeholder="輸入訊息…"
                    value={chatIn}
                    onChange={(e) => setChatIn(e.target.value)}
                  />
                  <button className="btn btn-accent">送出</button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
