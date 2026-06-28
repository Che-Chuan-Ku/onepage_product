import type { ConnState } from "@/lib/stomp/client";

const LABEL: Record<ConnState, string> = {
  online: "已連線",
  reconnecting: "重新連線中…",
  offline: "已離線",
};

/** Connection status indicator (room/game). Ports prototype `.conn` badge. */
export function ConnectionBadge({ state }: { state: ConnState }) {
  return (
    <span className={`conn ${state}`}>
      <span className="led" />
      <span>{LABEL[state]}</span>
    </span>
  );
}
