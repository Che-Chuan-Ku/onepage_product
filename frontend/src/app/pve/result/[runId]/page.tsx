"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { pveService } from "@/lib/api/pve";
import { ApiError } from "@/lib/api/client";
import type { PveRunResultResponse } from "@/lib/types/schemas";
import { PVE_RELIC_INFO } from "@/mocks/data/pveFixtures";
import { SKILL_NAME_ZH } from "@/components/pve/pveText";

import "../../pve.css";

/**
 * PVE 結算畫面 (specs/ui/PVE結算畫面.md; pve-ui-spec.md §5).
 *
 * 改用新增的權威結算 endpoint `GET /pve/runs/{runId}/result`
 * (api.yml:833-875) 取得 goldEarned/goldSpent/totalDamageDealt 等資料，取代
 * 先前以 sessionStorage 由觸發終結動作的頁面（棋盤關卡頁/商店頁）自行合成
 * 結果的暫時方案。查不到（Run仍進行中 422、找不到 404、非本人 403）就顯示
 * 明確的空狀態，不假造 demo 資料掩蓋。
 *
 * 例外：「本關已使用技能」「本關造成總傷害」這兩項單關結算復盤資訊不在
 * PveRunResultResponse schema 內（僅適用單關失敗 LOST 的情境），棋盤關卡頁
 * 在導頁前另存一份 optimistic 附加資訊到
 * `sessionStorage['pve-encounter-recap-' + runId]`，本頁讀到就顯示關卡復盤
 * 區塊；讀不到就只顯示 Run 結算，不臆測。
 */

interface EncounterRecap {
  encounterDamage: number;
  usedSkillsSnapshot: string[];
}

function isEncounterRecap(v: unknown): v is EncounterRecap {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.encounterDamage === "number" && Array.isArray(r.usedSkillsSnapshot);
}

const BANNER_TEXT: Record<string, string> = {
  WON: "Run 完成",
  LOST: "Run 失敗",
  ABANDONED: "已放棄",
};
const BANNER_CLASS: Record<string, string> = {
  WON: "won",
  LOST: "lost",
  ABANDONED: "abandoned",
};

export default function PveResultPage() {
  const params = useParams<{ runId: string }>();
  const [result, setResult] = useState<PveRunResultResponse | null>(null);
  const [recap, setRecap] = useState<EncounterRecap | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await pveService.getRunResult(params.runId);
        if (!cancelled) setResult(data);
      } catch (err) {
        if (err instanceof ApiError) {
          // 404/403/422（Run仍進行中）：維持 result=null，顯示空狀態。
          console.error("pve run result fetch failed", err.status, err.message);
        } else {
          console.error("pve run result fetch failed", err);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    try {
      const raw = sessionStorage.getItem(`pve-encounter-recap-${params.runId}`);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isEncounterRecap(parsed) && !cancelled) setRecap(parsed);
      }
    } catch {
      /* ignore malformed/unavailable sessionStorage */
    }
    return () => {
      cancelled = true;
    };
  }, [params.runId]);

  if (!loaded) {
    return (
      <>
        <AppHeader />
        <main className="page page-narrow center">
          <p className="dim">載入中…</p>
        </main>
      </>
    );
  }

  if (!result) {
    return (
      <>
        <AppHeader />
        <main className="page page-narrow">
          <div className="card pad col center" style={{ textAlign: "center", gap: 12 }}>
            <h2>找不到本次挑戰的結算資料</h2>
            <p className="dim">請確認是從挑戰流程中進入本頁，或返回首頁重新開始。</p>
            <Link className="btn btn-primary btn-block btn-lg" href="/">
              回首頁
            </Link>
          </div>
        </main>
      </>
    );
  }

  const showEncounterRecap = result.status === "LOST" && recap !== null;

  return (
    <>
      <AppHeader />
      <main className="page page-narrow">
        {showEncounterRecap && recap && (
          <div className="encounter-recap">
            <div className="result-banner lost" style={{ fontSize: 22 }}>
              挑戰失敗
            </div>
            <div className="pve-stat-grid">
              <div className="stat">
                <div className="v">{recap.encounterDamage}</div>
                <div className="k">本關造成總傷害</div>
              </div>
              <div className="stat">
                <div className="v">0</div>
                <div className="k">剩餘手數</div>
              </div>
              <div className="stat">
                <div className="v">{recap.usedSkillsSnapshot.length}</div>
                <div className="k">已使用技能種類</div>
              </div>
            </div>
            {recap.usedSkillsSnapshot.length > 0 && (
              <div className="dim" style={{ fontSize: 13 }}>
                已使用技能：{recap.usedSkillsSnapshot.join("、")}
              </div>
            )}
          </div>
        )}

        <div className="run-recap">
          <div className={`result-banner ${BANNER_CLASS[result.status] ?? ""}`} style={{ marginBottom: 10 }}>
            {BANNER_TEXT[result.status] ?? result.status}
            {result.status === "LOST" ? `（第${result.reachedEncounterSequence + 1}關）` : ""}
          </div>

          <div className="pve-stat-grid">
            <div className="stat">
              <div className="v">{result.reachedEncounterSequence}/8</div>
              <div className="k">到達關數</div>
            </div>
            <div className="stat">
              <div className="v">{result.totalDamageDealt}</div>
              <div className="k">全Run總傷害</div>
            </div>
            <div className="stat">
              <div className="v">🪙 {result.goldEarned}</div>
              <div className="k">獲得金幣</div>
            </div>
            <div className="stat">
              <div className="v">🪙 {result.goldSpent}</div>
              <div className="k">花費金幣</div>
            </div>
          </div>

          <div className="card pad mt-16">
            <div className="held-list">
              <span className="dim">最終持有遺物：</span>
              {result.finalHeldRelics.length ? (
                result.finalHeldRelics.map((r, i) => (
                  <span key={i} className="held-chip">
                    {PVE_RELIC_INFO[r.relicType].name}
                  </span>
                ))
              ) : (
                <span className="dim">無</span>
              )}
            </div>
            <div className="held-list mt-8">
              <span className="dim">最終持有技能：</span>
              {result.finalHeldSkills.length ? (
                result.finalHeldSkills.map((s) => (
                  <span key={s.skillType} className="held-chip">
                    {SKILL_NAME_ZH[s.skillType]} ×{s.quantity}
                  </span>
                ))
              ) : (
                <span className="dim">無</span>
              )}
            </div>
          </div>

          <div className="col gap-8 mt-24">
            <Link className="btn btn-primary btn-block btn-lg" href="/pve/class">
              再來一次
            </Link>
            <Link className="btn btn-ghost btn-block" href="/">
              回首頁
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
