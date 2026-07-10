"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { pveService } from "@/lib/api/pve";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/store/session";
import { toast } from "@/lib/store/toast";
import type { ClassType } from "@/lib/types/schemas";
import {
  PVE_STARTER_SKILL,
  PVE_BOSS_HP_CURVE,
  PVE_MOVE_BUDGET_CURVE,
  PVE_INITIAL_BOARD_ROWS,
  PVE_INITIAL_BOARD_COLS,
  PVE_ERROR,
} from "@/mocks/data/pveFixtures";
import { CLASS_NAME_ZH, CLASS_ICO, CLASS_SKILL_LIST_ZH, SKILL_NAME_ZH } from "@/components/pve/pveText";

import "../pve.css";

const CLASS_IDS: ClassType[] = ["WARRIOR", "ARCHER"];

/**
 * PVE 職業選擇頁 (specs/ui/PVE職業選擇頁.md; pve-ui-spec.md §2).
 * 只有在使用者「沒有進行中Run」時才會被導到這裡（首頁已先查過一次），
 * 但也要防直接打網址進來的情況，所以進場再守衛一次身分＋進行中Run
 * （對照 prototype pve-class/index.html 的 guardExistingRun()）。
 */
export default function PveClassPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // e2e-only determinism hook (?seed=xyz): lets tests inject a fixed
  // PveRunCreateRequest.seed so Template A/B and VOLCANO/BEACH picks are
  // reproducible (documents/PVE-關卡重設計-2026-07-08.md FR-A3). Real players
  // never set this query param, so normal play is unaffected.
  const seedOverride = searchParams.get("seed");
  const identity = useSession((s) => s.identity);
  const [picked, setPicked] = useState<ClassType | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (identity !== "registered") {
      toast(PVE_ERROR.GUEST_FORBIDDEN, "error");
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const run = await pveService.getCurrentRun();
        if (cancelled) return;
        if (run.currentEncounter) {
          toast(`偵測到進行中的 Run（第 ${run.currentEncounterSequence} 關），為你繼續挑戰…`, "success");
          router.replace(`/pve/game/${run.currentEncounter.encounterId}`);
          return;
        }
      } catch (err) {
        // 404 = 沒有進行中Run，是正常情況，留在本頁；其餘非 ApiError 才算真的 bug。
        if (!(err instanceof ApiError)) console.error("getCurrentRun failed", err);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identity, router]);

  async function startRun() {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const run = await pveService.createRun({
        classType: picked,
        ...(seedOverride ? { seed: seedOverride } : {}),
      });
      if (run.currentEncounter) {
        router.push(`/pve/game/${run.currentEncounter.encounterId}`);
      } else {
        console.error("createRun succeeded but response has no currentEncounter", run);
        toast("建立挑戰成功，但未取得關卡資訊", "error");
        setBusy(false);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // FR-C8：已有進行中的Run，須先結束才能建立新Run — 提供續玩導向。
        toast(err.message || PVE_ERROR.RUN_IN_PROGRESS, "error");
        try {
          const run = await pveService.getCurrentRun();
          if (run.currentEncounter) {
            router.push(`/pve/game/${run.currentEncounter.encounterId}`);
            return;
          }
        } catch (e2) {
          if (!(e2 instanceof ApiError)) console.error("getCurrentRun after 422 failed", e2);
        }
        setBusy(false);
      } else if (err instanceof ApiError) {
        if (err.status !== 401 && err.status !== 403) toast(err.message, "error");
        setBusy(false);
      } else {
        console.error("createRun failed", err);
        toast("建立挑戰失敗", "error");
        setBusy(false);
      }
    }
  }

  if (checking) {
    return (
      <>
        <AppHeader />
        <main className="page page-narrow center">
          <p className="dim">載入中…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="page page-narrow">
        <div className="center col" style={{ textAlign: "center", margin: "20px 0 24px" }}>
          <h1 style={{ fontSize: 28 }}>PVE 挑戰模式 · 選擇職業</h1>
          <p className="dim mt-8">選定職業後即建立新的挑戰 Run，開始第 1 關</p>
        </div>

        <div className="pve-info-banner">
          <span>
            手數預算 <b>{PVE_MOVE_BUDGET_CURVE[0]}</b>（第1關，每關獨立）
          </span>
          <span>
            Boss HP <b>{PVE_BOSS_HP_CURVE[0]}</b>（第1關）
          </span>
          <span>
            棋盤 <b>{PVE_INITIAL_BOARD_ROWS}×{PVE_INITIAL_BOARD_COLS}</b>
          </span>
          <span>
            場地 <b>PLAIN</b>（無場地效果）
          </span>
        </div>

        <div className="class-grid mt-16">
          {CLASS_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="button"
              tabIndex={0}
              className={`class-card${picked === id ? " selected" : ""}`}
              onClick={() => setPicked(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setPicked(id);
              }}
            >
              <div style={{ fontSize: 22 }}>
                {CLASS_ICO[id]} <b>{CLASS_NAME_ZH[id]}</b>
                {picked === id ? "（已選）" : ""}
              </div>
              <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                附贈技能：{SKILL_NAME_ZH[PVE_STARTER_SKILL[id]]}
              </div>
              <div className="skills">
                {CLASS_SKILL_LIST_ZH[id].map((s) => (
                  <div key={s}>{s}</div>
                ))}
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block mt-24"
          disabled={!picked || busy}
          onClick={startRun}
        >
          開始挑戰
        </button>
      </main>
    </>
  );
}
