"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useSession } from "@/lib/store/session";
import { authService } from "@/lib/api/services";
import { RegisterRequest, LoginRequest, GuestEnterRequest } from "@/lib/types/schemas";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/lib/store/toast";

type Tab = "login" | "register" | "guest";

/** Login / Register / Guest — ports prototype/user/index.html (Q3/Q4 rules). */
export default function UserPage() {
  const router = useRouter();
  const loginAs = useSession((s) => s.loginAs);
  const [tab, setTab] = useState<Tab>("login");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#guest") setTab("guest");
  }, []);

  async function doLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = LoginRequest.safeParse({
      username: fd.get("lu"),
      password: fd.get("lp"),
    });
    if (!parsed.success) {
      toast("帳號或密碼錯誤", "error");
      return;
    }
    try {
      const res = await authService.login(parsed.data);
      loginAs({
        identity: "registered",
        nickname: parsed.data.username,
        playerId: res.playerId,
        token: res.token,
      });
      toast(`歡迎回來，${parsed.data.username}！`, "success");
      setTimeout(() => router.push("/"), 600);
    } catch {
      toast("帳號或密碼錯誤", "error");
    }
  }

  async function doReg(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = RegisterRequest.safeParse({
      username: fd.get("ru"),
      email: fd.get("re"),
      password: fd.get("rp"),
    });
    if (!parsed.success) {
      // surface the first validation message (email/password rule, Q3)
      toast(parsed.error.issues[0]?.message ?? "註冊資料不合法", "error");
      return;
    }
    try {
      await authService.register(parsed.data);
      // 註冊 API 不回 JWT → 立即用同帳密登入取得 token，「已自動登入」才為真，
      // 否則後續 authenticated 請求會無 token 而 403（誤判為登入過期）。
      const res = await authService.login({
        username: parsed.data.username,
        password: parsed.data.password,
      });
      loginAs({
        identity: "registered",
        nickname: parsed.data.username,
        playerId: res.playerId,
        token: res.token,
      });
      toast("註冊成功，已自動登入", "success");
      setTimeout(() => router.push("/"), 600);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "註冊失敗";
      toast(msg, "error");
    }
  }

  async function doGuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = GuestEnterRequest.safeParse({ nickname: (fd.get("gn") as string)?.trim() });
    if (!parsed.success || !parsed.data.nickname) {
      toast("請先輸入暱稱", "error");
      return;
    }
    try {
      const res = await authService.guest(parsed.data);
      loginAs({ identity: "guest", nickname: res.nickname, playerId: res.guestId, token: res.token });
      toast("以訪客身份進入", "success");
      setTimeout(() => router.push("/"), 500);
    } catch {
      toast("無法以訪客進入", "error");
    }
  }

  return (
    <>
      <AppHeader />
      <main className="page page-narrow">
        <div className="card pad-lg">
          <div className="tabs" role="tablist">
            {(["login", "register", "guest"] as Tab[]).map((t) => (
              <div
                key={t}
                className={`tab${tab === t ? " active" : ""}`}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
              >
                {t === "login" ? "登入" : t === "register" ? "註冊" : "訪客"}
              </div>
            ))}
          </div>

          {tab === "login" && (
            <form onSubmit={doLogin}>
              <div className="field">
                <label htmlFor="lu">帳號 Username</label>
                <input className="input" id="lu" name="lu" autoComplete="username" required />
              </div>
              <div className="field">
                <label htmlFor="lp">密碼</label>
                <input className="input" id="lp" name="lp" type="password" autoComplete="current-password" required />
              </div>
              <button className="btn btn-primary btn-block">登入</button>
            </form>
          )}

          {tab === "register" && (
            <form onSubmit={doReg}>
              <div className="field">
                <label htmlFor="ru">帳號 Username</label>
                <input className="input" id="ru" name="ru" autoComplete="username" required />
              </div>
              <div className="field">
                <label htmlFor="re">Email</label>
                <input className="input" id="re" name="re" type="email" autoComplete="email" required />
              </div>
              <div className="field">
                <label htmlFor="rp">密碼</label>
                <input className="input" id="rp" name="rp" type="password" autoComplete="new-password" required />
                <span className="dim" style={{ fontSize: 12 }}>
                  最短 8 碼，須同時含英文小寫字母與數字
                </span>
              </div>
              <button className="btn btn-primary btn-block">建立帳號</button>
            </form>
          )}

          {tab === "guest" && (
            <form onSubmit={doGuest}>
              <p className="dim" style={{ marginBottom: 14 }}>
                輸入暱稱，立即開玩。線上模式僅限單場，戰績不保存。
              </p>
              <div className="field">
                <label htmlFor="gn">暱稱</label>
                <input className="input" id="gn" name="gn" placeholder="例如：快手小王" autoComplete="nickname" />
              </div>
              <button className="btn btn-primary btn-block">以訪客進入</button>
            </form>
          )}
        </div>
        <p className="dim center mt-16" style={{ fontSize: 13 }}>
          <Link href="/">← 回首頁</Link>
        </p>
      </main>
    </>
  );
}
