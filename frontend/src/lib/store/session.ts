import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAuthToken, setUnauthorizedHandler } from "@/lib/api/client";
import { toast } from "@/lib/store/toast";

export type Identity = "none" | "guest" | "registered";

interface SessionState {
  identity: Identity;
  nickname: string;
  playerId: string | null;
  token: string | null;
  loginAs: (p: { identity: Identity; nickname: string; playerId?: string; token?: string }) => void;
  logout: () => void;
}

/**
 * Auth/identity state (Q4 三態：none / guest / registered). Persisted to
 * localStorage so refreshes keep the session; token is mirrored into the
 * API client for the Authorization header.
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      identity: "none",
      nickname: "",
      playerId: null,
      token: null,
      loginAs: ({ identity, nickname, playerId = null, token = null }) => {
        setAuthToken(token);
        set({ identity, nickname, playerId, token });
      },
      logout: () => {
        setAuthToken(null);
        set({ identity: "none", nickname: "", playerId: null, token: null });
      },
    }),
    {
      name: "gmk-session",
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token);
      },
    },
  ),
);

// 登入失效(token 過期/無效，安全層 401/403 無信封)時：清 session、提示、導回登入頁。
// 延遲硬導向，讓 toast 先渲染出來（否則 location.href 會在提示顯示前就跳走）。
setUnauthorizedHandler(() => {
  useSession.getState().logout();
  toast("登入已過期，請重新登入", "error");
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/user")) {
    setTimeout(() => {
      window.location.href = "/user";
    }, 900);
  }
});
