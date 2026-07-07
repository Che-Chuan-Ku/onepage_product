"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { pveService } from "@/lib/api/pve";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/lib/store/toast";
import type {
  PveHeldRelicItem,
  PveHeldSkillItem,
  PveShopStateResponse,
} from "@/lib/types/schemas";
import {
  PVE_RELIC_HOLD_CAP,
  PVE_RELIC_INFO,
  PVE_SHOP_REROLL_COST,
  PVE_SKILL_HOLD_CAP,
} from "@/mocks/data/pveFixtures";
import { SKILL_NAME_ZH } from "@/components/pve/pveText";

import "../../pve.css";

/**
 * PVE 商店頁 (specs/ui/PVE商店頁.md; pve-ui-spec.md §4). Entered after
 * clearing an encounter (not the 8th). Purchase/reroll/skip all hit
 * /pve/runs/{runId}/shop/actions/*; skip's response is a union
 * (PveShopSkipResponse) discriminated via `"encounterId" in data`
 * (see pve-api-layer-usage.md).
 */
export default function PveShopPage() {
  const params = useParams<{ runId: string }>();
  const router = useRouter();
  const runId = params.runId;

  const [shop, setShop] = useState<PveShopStateResponse | null>(null);
  const [heldSkills, setHeldSkills] = useState<PveHeldSkillItem[]>([]);
  const [heldRelics, setHeldRelics] = useState<PveHeldRelicItem[]>([]);
  const [busy, setBusy] = useState(false);

  // PveShopStateResponse 本身不含持有清單（只有 gold），持有遺物/技能要另外
  // 查 Run 狀態（GET /pve/runs/current，見 pve-api-layer-usage.md）。
  const loadHeld = useCallback(async () => {
    try {
      const run = await pveService.getCurrentRun();
      setHeldSkills(run.heldSkills);
      setHeldRelics(run.heldRelics);
    } catch (err) {
      if (!(err instanceof ApiError)) console.error("getCurrentRun (shop held) failed", err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await pveService.getShop(runId);
        setShop(s);
      } catch (err) {
        if (!(err instanceof ApiError)) console.error("getShop failed", err);
        else toast(err.message, "error");
      }
    })();
    loadHeld();
  }, [runId, loadHeld]);

  async function purchase(slotIndex: number) {
    if (busy) return;
    setBusy(true);
    try {
      const s = await pveService.purchaseShopOffer(runId, { slotIndex });
      setShop(s);
      await loadHeld();
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, "error");
      else console.error("purchase failed", err);
    } finally {
      setBusy(false);
    }
  }

  async function reroll() {
    if (busy) return;
    setBusy(true);
    try {
      const s = await pveService.rerollShop(runId);
      setShop(s);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, "error");
      else console.error("reroll failed", err);
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await pveService.skipShop(runId);
      if ("encounterId" in data) {
        router.push(`/pve/game/${data.encounterId}`);
        return;
      }
      // 第8關通關後跳過商店直接進 Run 結算（防禦性分支，正常流程第8關通關由
      // placePveMove 直接結算 WON，不會開商店）。結算頁自行呼叫
      // GET /pve/runs/{runId}/result 取得權威結算，這裡不再暫存回應。
      router.push(`/pve/result/${data.runId}`);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, "error");
      else console.error("skip failed", err);
      setBusy(false);
    }
  }

  if (!shop) {
    return (
      <>
        <AppHeader />
        <main className="page page-narrow center">
          <p className="dim">載入商店中…</p>
        </main>
      </>
    );
  }

  const heldSkillQty = heldSkills.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <>
      <AppHeader />
      <main className="page shop-page">
        <div className="center col" style={{ textAlign: "center", margin: "20px 0 20px" }}>
          <h1 style={{ fontSize: 26 }}>已通過第 {shop.afterEncounterSequence} 關</h1>
          <p className="dim mt-8">用金幣購買遺物或技能，構築下一關的連段</p>
        </div>

        <div className="shop-grid">
          {shop.offers.map((offer) => {
            const isRelic = offer.offerKind === "RELIC";
            const name = isRelic
              ? offer.relicType
                ? PVE_RELIC_INFO[offer.relicType].name
                : "?"
              : offer.skillType
                ? SKILL_NAME_ZH[offer.skillType]
                : "?";
            const effect =
              isRelic && offer.relicType ? PVE_RELIC_INFO[offer.relicType].summary : "本職業技能池抽取";
            const atCap = isRelic ? heldRelics.length >= PVE_RELIC_HOLD_CAP : heldSkillQty >= PVE_SKILL_HOLD_CAP;
            const insufficientGold = shop.gold < offer.price;
            const disabled = offer.purchased || atCap || busy || insufficientGold;
            const label = offer.purchased ? "已購買" : atCap ? "已達上限" : "購買";
            return (
              <div
                key={offer.slotIndex}
                className={`shop-card${offer.purchased ? " bought" : ""}${atCap ? " maxed" : ""}`}
              >
                <div className="kind">{isRelic ? "遺物" : "技能"}</div>
                <h4>{name}</h4>
                <div className="dim" style={{ fontSize: 13 }}>
                  {effect}
                </div>
                <div className="price">🪙 {offer.price}</div>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={disabled}
                  onClick={() => purchase(offer.slotIndex)}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>

        <div className="card pad mt-16">
          <div className="held-list">
            <span className="dim">
              持有遺物（{heldRelics.length}/{PVE_RELIC_HOLD_CAP}）：
            </span>
            {heldRelics.length ? (
              heldRelics.map((r, i) => (
                <span key={i} className="held-chip">
                  {PVE_RELIC_INFO[r.relicType].name}
                </span>
              ))
            ) : (
              <span className="dim">無</span>
            )}
          </div>
          <div className="held-list mt-8">
            <span className="dim">
              持有技能（{heldSkillQty}/{PVE_SKILL_HOLD_CAP}）：
            </span>
            {heldSkills.length ? (
              heldSkills.map((s) => (
                <span key={s.skillType} className="held-chip">
                  {SKILL_NAME_ZH[s.skillType]} ×{s.quantity}
                </span>
              ))
            ) : (
              <span className="dim">無</span>
            )}
          </div>
        </div>

        <div className="shop-actionbar">
          <div className="coin-display">
            <span className="ico">🪙</span>
            {shop.gold}
          </div>
          <div className="row gap-8">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || shop.gold < PVE_SHOP_REROLL_COST}
              onClick={reroll}
            >
              重抽（{PVE_SHOP_REROLL_COST}🪙）
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={skip}>
              跳過，前往下一關
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
