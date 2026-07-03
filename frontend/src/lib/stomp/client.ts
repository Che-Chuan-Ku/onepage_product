import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WS_ENDPOINT } from "@/lib/api/config";
import { getAuthToken } from "@/lib/api/client";

export type ConnState = "online" | "reconnecting" | "offline";

/**
 * Thin STOMP-over-SockJS wrapper for the real-time channels (api.yml
 * x-stomp-channels). The backend is not yet online, so connection failures
 * are expected; consumers drive the ConnectionBadge off `onState`. Auto
 * reconnect (5s) covers the 斷線重連 flow (需求 #9).
 */
export class StompClient {
  private client: Client | null = null;
  private subs = new Map<string, StompSubscription>();
  // 訂閱登記表：所有呼叫過 subscribe() 的 destination/callback，長期保留（不只
  // 是「尚未套用」的清單）。每次 onConnect（含 reconnectDelay 觸發的自動重連）
  // 都會整批重新套用，否則重連後底層 subscription 已失效但收不到任何推播
  // （手機鎖屏/背景斷線重連後看不到對方落子的根因）。
  private registrations: Array<{ destination: string; cb: (body: unknown) => void }> = [];
  private state: ConnState = "offline";
  private visibilityHandler = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState !== "visible") return;
    if (this.state === "online") return;
    // 手機從鎖屏/背景切回前景：底層 socket 可能早已死亡但計時器被系統節流，
    // reconnectDelay 的下一次嘗試可能還要等好幾秒 —— 強制立即重新 activate，
    // 不等 stompjs 自己的 backoff。
    this.client?.deactivate({ force: true }).then(() => {
      this.client?.activate();
    });
  };
  onState?: (s: ConnState) => void;

  connect() {
    if (this.client) return;
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_ENDPOINT) as unknown as WebSocket,
      reconnectDelay: 5000,
      connectHeaders: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
      onConnect: () => {
        // 重新套用「所有」已登記的訂閱（不是只有初次的待訂閱清單）——確保 badge
        // 「已連線」時訂閱已生效，也讓自動重連後不會漏接後續廣播。舊的
        // StompSubscription 物件已隨底層連線失效，先清空避免重複訂閱同一 destination。
        this.subs.clear();
        this.registrations.forEach((r) => this.doSubscribe(r.destination, r.cb));
        this.setState("online");
      },
      onWebSocketClose: () => this.setState("reconnecting"),
      onStompError: () => this.setState("offline"),
    });
    this.setState("reconnecting");
    client.activate();
    this.client = client;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  private setState(s: ConnState) {
    this.state = s;
    this.onState?.(s);
  }

  subscribe<T = unknown>(destination: string, cb: (body: T) => void) {
    // 永久登記，之後每次 onConnect（含重連）都會重新套用。
    this.registrations.push({ destination, cb: cb as (body: unknown) => void });
    if (this.client?.connected) {
      this.doSubscribe(destination, cb);
    }
  }

  private doSubscribe<T>(destination: string, cb: (body: T) => void) {
    const sub = this.client!.subscribe(destination, (msg: IMessage) => {
      try {
        cb(JSON.parse(msg.body) as T);
      } catch {
        /* ignore malformed frame */
      }
    });
    this.subs.set(destination, sub);
  }

  send(destination: string, body: unknown) {
    this.client?.publish({ destination, body: JSON.stringify(body) });
  }

  disconnect() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
    this.subs.forEach((s) => s.unsubscribe());
    this.subs.clear();
    this.registrations = [];
    this.client?.deactivate();
    this.client = null;
    this.setState("offline");
  }

  getState() {
    return this.state;
  }
}
