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
  // 待訂閱清單：連線建立(onConnect)時立即套用，避免「已連線但尚未訂閱」的競態窗口。
  private pending: Array<{ destination: string; cb: (body: unknown) => void }> = [];
  private state: ConnState = "offline";
  onState?: (s: ConnState) => void;

  connect() {
    if (this.client) return;
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_ENDPOINT) as unknown as WebSocket,
      reconnectDelay: 5000,
      connectHeaders: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
      onConnect: () => {
        // 先建立所有待訂閱，再標記 online —— 確保 badge「已連線」時訂閱已生效，
        // 不會漏接緊接而來的廣播（reconnect 後也會重新套用）。
        const toApply = [...this.pending];
        this.pending = [];
        toApply.forEach((p) => this.doSubscribe(p.destination, p.cb));
        this.setState("online");
      },
      onWebSocketClose: () => this.setState("reconnecting"),
      onStompError: () => this.setState("offline"),
    });
    this.setState("reconnecting");
    client.activate();
    this.client = client;
  }

  private setState(s: ConnState) {
    this.state = s;
    this.onState?.(s);
  }

  subscribe<T = unknown>(destination: string, cb: (body: T) => void) {
    if (this.client?.connected) {
      this.doSubscribe(destination, cb);
    } else {
      // 尚未連線：登記，onConnect 時立即套用
      this.pending.push({ destination, cb: cb as (body: unknown) => void });
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
    this.subs.forEach((s) => s.unsubscribe());
    this.subs.clear();
    this.client?.deactivate();
    this.client = null;
    this.setState("offline");
  }

  getState() {
    return this.state;
  }
}
