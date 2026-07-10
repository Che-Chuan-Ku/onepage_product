"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { PveBoard } from "@/components/pve-game/PveBoard";
import { PveStrategyCard } from "@/components/pve-game/PveStrategyCard";
import { pveService } from "@/lib/api/pve";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/lib/store/toast";
import {
  PVE_DIR_LABEL,
  PVE_DUEL_DRAW_COPY,
  PVE_DUEL_FAIL_COPY,
  PVE_FIELD_LABEL,
  PVE_MUTATION_ICON,
  PVE_MUTATION_LABEL,
  PVE_SKILL_DIRECTIONS,
  PVE_HORIZONTAL_VOID_TOAST,
  bossLastMoveFrom,
  bossSkillCastFrom,
  horizontalFiveCells,
  buildSkillRequest,
  duelFailReason,
  presentPveEvent,
  scatterDistanceOk,
  skillFlowPreviewCells,
  startSkillFlow,
  type PveSkillFlow,
} from "@/lib/game/pveBoard";
import { strategyCardFor } from "@/lib/game/pveStrategyCards";
import { PVE_RELIC_INFO } from "@/mocks/data/pveFixtures";
import { SKILL_NAME_ZH } from "@/components/pve/pveText";
import type {
  Cell,
  PveEncounterStateResponse,
  PveHeldRelicItem,
  PveHeldSkillItem,
  SkillDirection,
  SkillType,
} from "@/lib/types/schemas";

import "../pve-game.css";

interface DamageFloat {
  id: number;
  text: string;
  sub: string;
}

let dmgFloatSeq = 0;

/**
 * A1 修正（PVE-八關評論彙編與迭代清單-2026-07-08.md）：「本關已造成傷害」一律
 * 從權威 encounter.bossHpMax - encounter.bossHpCurrent 推導，不再用本地累加器
 * （sessionDamage）——累加器只在「本次頁面 session 內」發生的落子/技能才會加總，
 * 一旦玩家刷新頁面或從別處續玩回這關（FR-B6 續玩），累加器會重置成0，但
 * bossHpCurrent 早已反映之前造成的傷害，兩者對不上，面板就會顯示「0」。
 * 用 bossHpMax-bossHpCurrent 永遠正確，且不需要任何本地狀態。
 */
function encounterDamageDealt(enc: PveEncounterStateResponse): number {
  return Math.max(0, enc.bossHpMax - enc.bossHpCurrent);
}

/**
 * PVE 挑戰模式 — 棋盤關卡頁 (specs/ui/PVE棋盤關卡頁.md; pve-ui-spec.md §3).
 * Most complex PVE page: 11x11 board, boss HP / move-budget bars, field +
 * mutation display, touch-confirm placement, independent/consumable skill
 * use, and per-encounter clear/fail overlay before routing onward.
 *
 * 本關已使用技能改讀權威 `PveEncounterStateResponse.usedSkills`（api.yml
 * usedSkills 欄位）而非本地追蹤，斷線續玩查詢會拿到同一份清單，不再需要
 * sessionStorage 暫存。Run 結束時（第8關通關直接 CLEARED、或手數用盡
 * FAILED）不再於此頁合成 goldEarned/goldSpent=0 的假結果——改由結算頁
 * (app/pve/result/[runId]) 呼叫新增的 `GET /pve/runs/{runId}/result`
 * 端點取得權威結算；本頁只在 LOST 時另外存一份「本關戰況」optimistic
 * 附加資訊（本關傷害／已使用技能）供結算頁的關卡復盤區塊顯示。
 */
export default function PveGamePage() {
  const params = useParams<{ encounterId: string }>();
  const router = useRouter();
  const encounterId = params.encounterId;

  const [encounter, setEncounter] = useState<PveEncounterStateResponse | null>(null);
  const [heldSkills, setHeldSkills] = useState<PveHeldSkillItem[]>([]);
  const [heldRelics, setHeldRelics] = useState<PveHeldRelicItem[]>([]);
  const [runFetchFailed, setRunFetchFailed] = useState(false);

  const [pendingCell, setPendingCell] = useState<Cell | null>(null);
  const [skillFlow, setSkillFlow] = useState<PveSkillFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const [damageFloats, setDamageFloats] = useState<DamageFloat[]>([]);
  const [fxClass, setFxClass] = useState<string>("");
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [outcome, setOutcome] = useState<
    null | { kind: "cleared" | "failed" | "draw"; damage: number; reasonText?: string }
  >(null);
  const [retrying, setRetrying] = useState(false);
  // 策略卡（§2.2）：關卡載入後、棋盤可互動前顯示，「開始」後才收起。每次換關
  // （encounterId 變化）重新顯示一次。
  const [showStrategyCard, setShowStrategyCard] = useState(true);
  // DUEL關（§5.2）：Boss最近一手回應座標，短暫高亮；換一次落子/技能後才更新。
  const [bossLastMove, setBossLastMove] = useState<Cell | null>(null);
  // L8 SKILL_DEMON（documents/PVE-全對弈階梯設計-2026-07-10.md §3/§9.2）：Boss
  // 最近一次施放的技能（精準狙擊/散射/開拓之星），短暫高亮受影響格。
  const [bossSkillCells, setBossSkillCells] = useState<Cell[]>([]);

  // ── load: refresh 直接重拉 encounter 續玩 (增量需求 持久化與續玩) ──
  useEffect(() => {
    let cancelled = false;
    setShowStrategyCard(true);
    setBossLastMove(null);
    setBossSkillCells([]);
    (async () => {
      let enc: PveEncounterStateResponse;
      try {
        enc = await pveService.getEncounter(encounterId);
      } catch (err) {
        if (err instanceof ApiError) {
          toast(err.message, "error");
          router.push("/");
        } else {
          console.error("pve encounter fetch failed", err);
        }
        return;
      }
      if (cancelled) return;
      setEncounter(enc);
      // bug fix（task item #4）：重新整理／重進一個已結束（CLEARED/FAILED/DRAW）
      // 的關卡頁面時，先前只有 applyEncounterResponse（落子/技能等「即時」回應）
      // 才會觸發 outcome 覆蓋層——這條初次載入路徑只 setEncounter 就結束，導致
      // 重進已通關/已敗北的關卡完全看不到結算畫面/不會被導去結算頁。比照
      // applyEncounterResponse 的判斷，依讀到的權威 status 補上同一組處理。
      if (enc.status === "CLEARED") {
        handleCleared(enc);
      } else if (enc.status === "FAILED") {
        handleFailed(enc);
      } else if (enc.status === "DRAW") {
        handleDrawn();
      }
      try {
        const run = await pveService.getCurrentRun();
        if (cancelled) return;
        setHeldSkills(run.heldSkills);
        setHeldRelics(run.heldRelics);
      } catch (err) {
        // 極端情況：Run 已在別處結束才重整本頁。關卡仍可唯讀顯示，僅缺 heldSkills/relics。
        setRunFetchFailed(true);
        if (!(err instanceof ApiError)) console.error("pve run fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]);

  function pushDamageFloat(dmg: number, breakdown: string) {
    const id = ++dmgFloatSeq;
    setDamageFloats((prev) => [...prev, { id, text: `-${dmg}`, sub: breakdown }]);
    setTimeout(() => setDamageFloats((prev) => prev.filter((f) => f.id !== id)), 1200);
  }

  function flashFx(cls: string) {
    setFxClass(cls);
    setTimeout(() => setFxClass(""), 1200);
  }

  function applyEncounterResponse(enc: PveEncounterStateResponse) {
    setEncounter(enc);
    if (enc.encounterType === "DUEL") {
      setBossLastMove(bossLastMoveFrom(enc));
      const cast = bossSkillCastFrom(enc);
      if (cast) {
        setBossSkillCells(cast.cells);
        toast(`Boss 使用了 ${SKILL_NAME_ZH[cast.skillType] ?? cast.skillType}`, "info");
      } else {
        setBossSkillCells([]);
      }
    }
    if (enc.lastResolution) {
      const breakdown = enc.lastResolution.linesResolved
        .map((l) => `${l.length}連 ${l.baseScore}×${l.multiplier.toFixed(1)}`)
        .join("、");
      pushDamageFloat(enc.lastResolution.damageDealt, breakdown);
    }
    for (const ev of enc.events) {
      const p = presentPveEvent(ev);
      if (p) {
        toast(p.msg, p.type);
        if (p.type === "tide") flashFx("pveg-fx-wave");
        if (ev.eventType === "VOLCANO_ERUPTED") flashFx("pveg-fx-burn");
      }
    }
    if (enc.status === "CLEARED") {
      handleCleared(enc);
    } else if (enc.status === "FAILED") {
      handleFailed(enc);
    } else if (enc.status === "DRAW") {
      handleDrawn();
    }
  }

  /**
   * DUEL 和局（2026-07-09 §1.5/§6.5 公平性修正）：手數耗盡且雙方皆未連五。
   * 與 CLEARED/FAILED 不同——不導向結算頁、Run 不受影響——顯示「勢均力敵」
   * 提示，玩家按「再來一局」呼叫 retryPveEncounter 原地重開本關（新
   * encounterId、盤面重新開始），可無限次重試。
   */
  function handleDrawn() {
    setOutcome({ kind: "draw", damage: 0, reasonText: PVE_DUEL_DRAW_COPY });
  }

  async function retryDrawnEncounter() {
    if (!encounter || retrying) return;
    setRetrying(true);
    try {
      const fresh = await pveService.retryEncounter(encounter.encounterId);
      setOutcome(null);
      setPendingCell(null);
      setSkillFlow(null);
      setBossLastMove(null);
      setShowStrategyCard(true);
      setEncounter(fresh);
      // encounterId 已變（舊關卡已在後端標記刪除），更新網址但不觸發整頁
      // 重新導航／不重跑上方 useEffect 的初次載入流程（該流程只在 encounterId
      // 這個 route param 變化時跑；用 replaceState 只換網址列顯示，行為與其他
      // 純用戶端狀態轉換一致，避免多一次不必要的 GET /encounters 往返）。
      window.history.replaceState(null, "", `/pve/game/${fresh.encounterId}`);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, "error");
      else console.error("pve retry failed", err);
    } finally {
      setRetrying(false);
    }
  }

  function handleCleared(enc: PveEncounterStateResponse) {
    // A1 修正：改讀權威 bossHpMax-bossHpCurrent（本關累計傷害），不再靠本地
    // sessionDamage 累加器——後者在頁面刷新/續玩後會重置為0，導致「本關已造成
    // 傷害：0」的顯示bug（即使boss早已被打掉大半血量）。
    // DUEL關（§5.2）改用「五連達成，你贏了！」文案，不提傷害概念。
    setOutcome({
      kind: "cleared",
      damage: encounterDamageDealt(enc),
      reasonText: enc.encounterType === "DUEL" ? "五連達成，你贏了！" : undefined,
    });
    setTimeout(() => {
      if (enc.sequence >= 8) {
        // Run 已在後端直接結算為 WON（settleEncounterClear）；結算頁自行呼叫
        // GET /pve/runs/{runId}/result 取得權威 goldEarned/goldSpent，本頁不再
        // 合成假結果。
        router.push(`/pve/result/${enc.runId}`);
      } else {
        router.push(`/pve/shop/${enc.runId}`);
      }
    }, 900);
  }

  function handleFailed(enc: PveEncounterStateResponse) {
    const encDamage = encounterDamageDealt(enc);
    // DUEL關（§5.2）需區分「Boss五連」與「手數耗盡」兩種敗因文案。
    const reason = duelFailReason(enc);
    setOutcome({
      kind: "failed",
      damage: encDamage,
      reasonText: reason ? PVE_DUEL_FAIL_COPY[reason] : undefined,
    });
    setTimeout(() => {
      // Run 已在後端結算為 LOST；權威 goldEarned/goldSpent/totalDamageDealt 由
      // 結算頁呼叫 GET /pve/runs/{runId}/result 取得。這裡只留一份「本關戰況」
      // optimistic 附加資訊（本關傷害／已使用技能，非 PveRunResultResponse
      // 欄位）給結算頁的關卡復盤區塊顯示。
      try {
        sessionStorage.setItem(
          `pve-encounter-recap-${enc.runId}`,
          JSON.stringify({
            encounterDamage: encDamage,
            usedSkillsSnapshot: enc.usedSkills.map((s) => SKILL_NAME_ZH[s]),
          }),
        );
      } catch {
        /* ignore */
      }
      router.push(`/pve/result/${enc.runId}`);
    }, 900);
  }

  // ── move placement (touch-confirm flow for both mouse and touch) ──
  function onBoardCellClick(row: number, col: number) {
    if (!encounter || encounter.status !== "IN_PROGRESS" || busy) return;
    if (skillFlow) {
      onSkillCellClick(row, col);
      return;
    }
    const stoneHit = encounter.stones.some((s) => s.row === row && s.col === col);
    const obstacleHit = encounter.obstacles.some((o) => o.row === row && o.col === col);
    if (stoneHit) {
      toast("該位置已有棋子", "error");
      return;
    }
    if (obstacleHit) {
      toast("該格為障礙格，禁止落子", "error");
      return;
    }
    setPendingCell({ row, col });
  }

  async function confirmMove() {
    if (!encounter || !pendingCell || busy) return;
    setBusy(true);
    try {
      const enc = await pveService.placeMove(encounter.encounterId, pendingCell);
      setPendingCell(null);
      applyEncounterResponse(enc);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, "error");
      else console.error("pve move failed", err);
    } finally {
      setBusy(false);
    }
  }

  function cancelPending() {
    setPendingCell(null);
  }

  // ── skill use ────────────────────────────────────────────────────
  function onSkillButtonClick(skillType: SkillType) {
    if (!encounter || encounter.status !== "IN_PROGRESS" || busy) return;
    if (!encounter.skillUsableThisInterval) {
      toast("本間隔已使用過技能", "error");
      return;
    }
    const held = heldSkills.find((s) => s.skillType === skillType && s.quantity > 0);
    if (!held) {
      toast("未持有該技能", "error");
      return;
    }
    if (skillFlow?.skillType === skillType) {
      setSkillFlow(null); // toggle off
      return;
    }
    setPendingCell(null);
    setSkillFlow(startSkillFlow(skillType));
  }

  function pickSkillDirection(dir: SkillDirection) {
    if (!skillFlow) return;
    // 橫劈/縱劈（axis）與大絕（ultimate）選定方向後都還需要一個棋盤錨點：
    // axis 是推擠參考格（api.yml SkillActionRequest.anchor 說明，PVE 無伴隨落子
    // 故改由此欄位提供），ultimate 是施法錨點。兩者接著都進入 "anchor" 階段，
    // 由 onSkillCellClick 收集 anchor 後才會到 "ready"。修正前 axis 分支直接跳
    // "ready"、從未收集 anchor，導致送出的 anchor 永遠是 null（後端 422）。
    if (skillFlow.mode === "axis" || skillFlow.mode === "ultimate") {
      setSkillFlow({ ...skillFlow, direction: dir, stage: "anchor" });
    }
  }

  function onSkillCellClick(row: number, col: number) {
    if (!skillFlow || !encounter) return;
    const stoneHit = encounter.stones.some((s) => s.row === row && s.col === col);
    const obstacleHit = encounter.obstacles.some((o) => o.row === row && o.col === col);
    if (skillFlow.mode === "axis" && skillFlow.stage === "anchor") {
      // 橫劈/縱劈錨點＝推擠參考格，可為空格或現有棋子（api.yml anchor 說明；
      // 後端 slashPush 僅檢查 in-bounds，不限空格），故不擋 stoneHit/obstacleHit。
      setSkillFlow({ ...skillFlow, anchor: { row, col }, stage: "ready" });
    } else if (skillFlow.mode === "ultimate" && skillFlow.stage === "anchor") {
      if (stoneHit || obstacleHit) {
        toast("大絕錨點須為空格", "error");
        return;
      }
      setSkillFlow({ ...skillFlow, anchor: { row, col }, stage: "ready" });
    } else if (skillFlow.mode === "target" && skillFlow.stage === "target") {
      if (!stoneHit) {
        toast("請選擇一顆現存棋子作為目標", "error");
        return;
      }
      setSkillFlow({ ...skillFlow, target: { row, col }, stage: "ready" });
    } else if (skillFlow.mode === "scatter") {
      if (stoneHit || obstacleHit) {
        toast("散射座標須為空格", "error");
        return;
      }
      if (skillFlow.stage === "first") {
        setSkillFlow({ ...skillFlow, anchor: { row, col }, stage: "second" });
      } else if (skillFlow.stage === "second") {
        if (!scatterDistanceOk(skillFlow.anchor!, { row, col })) {
          toast("散射兩點距離需至少2格，請重新選擇第二點", "error");
          return;
        }
        setSkillFlow({ ...skillFlow, secondStone: { row, col }, stage: "ready" });
      }
    }
    // stage === "direction" (axis/ultimate awaiting a direction pick first):
    // board clicks are ignored until a direction is chosen via the D-pad.
  }

  function cancelSkillFlow() {
    setSkillFlow(null);
  }

  async function confirmSkill() {
    if (!encounter || !skillFlow || skillFlow.stage !== "ready" || busy) return;
    setBusy(true);
    const skillType = skillFlow.skillType;
    try {
      const body = buildSkillRequest(skillFlow);
      const enc = await pveService.useSkill(encounter.encounterId, body);
      // useSkill 回應是 PveEncounterStateResponse，不含 heldSkills——持有量在
      // 此本地維護，與 mock engine 的遞減/去重邏輯保持一致（pveEngine.ts
      // usePveSkill）。usedSkills 已改讀回應本身的權威欄位（applyEncounterResponse
      // 之後的 encounter.usedSkills），不再本地追蹤。
      setHeldSkills((prev) =>
        prev
          .map((s) => (s.skillType === skillType ? { ...s, quantity: s.quantity - 1 } : s))
          .filter((s) => s.quantity > 0),
      );
      setSkillFlow(null);
      applyEncounterResponse(enc);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, "error");
      else console.error("pve skill failed", err);
    } finally {
      setBusy(false);
    }
  }

  // ── abandon ──────────────────────────────────────────────────────
  async function doAbandon() {
    if (!encounter || busy) return;
    setBusy(true);
    try {
      // abandonRun 已將 Run 標記為 ABANDONED；結算頁自行呼叫
      // GET /pve/runs/{runId}/result 取得權威結算，這裡不再需要暫存回應。
      await pveService.abandonRun(encounter.runId);
      router.push(`/pve/result/${encounter.runId}`);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, "error");
      else console.error("pve abandon failed", err);
      setBusy(false);
    } finally {
      setConfirmAbandon(false);
    }
  }

  const skillPreviewCells = useMemo(() => skillFlowPreviewCells(skillFlow), [skillFlow]);
  // L3 不可橫向 即時回饋（§7.6 item #2）：任一方湊成橫向五連的瞬間，該線灰化/
  // 虛線渲染 + toast「橫向連線不計勝負！」。純由權威盤面推導（玩家黑子 stones
  // ＋ Boss 白子 ENEMY_STONE obstacles），不需要新 API 欄位。
  const voidLineCells = useMemo(() => {
    if (!encounter?.horizontalDisabled) return [];
    return horizontalFiveCells(
      encounter.stones,
      encounter.obstacles.filter((o) => o.kind === "ENEMY_STONE"),
    );
  }, [encounter]);
  const toastedVoidKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    toastedVoidKeysRef.current = new Set();
  }, [encounterId]);
  useEffect(() => {
    if (voidLineCells.length === 0) return;
    const seen = toastedVoidKeysRef.current;
    const fresh = voidLineCells.some((c) => !seen.has(`${c.row},${c.col}`));
    if (fresh) {
      toast(PVE_HORIZONTAL_VOID_TOAST, "info");
      voidLineCells.forEach((c) => seen.add(`${c.row},${c.col}`));
    }
  }, [voidLineCells]);
  // 本關已使用技能改讀權威 PveEncounterStateResponse.usedSkills（FR-B7），不再
  // 本地追蹤／存 sessionStorage。
  const usedSkillLabels = useMemo(
    () => (encounter?.usedSkills ?? []).map((s) => SKILL_NAME_ZH[s]),
    [encounter],
  );
  // bug fix：舊版 usedSkills 曾把 L8 Boss 的施法也混入玩家清單、前端無標註——
  // 改讀分開的 bossUsedSkills，並在每個項目加「魔王」標籤區分。
  const bossUsedSkillLabels = useMemo(
    () => (encounter?.bossUsedSkills ?? []).map((s) => `${SKILL_NAME_ZH[s]}（魔王）`),
    [encounter],
  );
  const boardInteractive =
    !!encounter && encounter.status === "IN_PROGRESS" && !busy && !outcome && !showStrategyCard;
  const isDuel = encounter?.encounterType === "DUEL";
  const strategyCard = encounter ? strategyCardFor(encounter.sequence) : null;

  if (!encounter) {
    return (
      <>
        <AppHeader />
        <main className="page center">
          <p className="dim">載入中…</p>
        </main>
      </>
    );
  }

  const bossHpPct = Math.max(0, Math.round((encounter.bossHpCurrent / encounter.bossHpMax) * 100));
  const remainingMoves = Math.max(0, encounter.moveBudget - encounter.movesUsed);
  const movePct = Math.round((remainingMoves / encounter.moveBudget) * 100);

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="pveg-info-bar">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setConfirmAbandon(true)}
          >
            放棄挑戰
          </button>
          <span className="pveg-stage-badge">第 {encounter.sequence}/8 關</span>
          <span className="pveg-field-badge">{PVE_FIELD_LABEL[encounter.fieldType]}</span>
          {runFetchFailed && <span className="dim" style={{ fontSize: 12 }}>（部分Run資訊無法取得）</span>}
        </div>

        {encounter.mutationType !== "NONE" && (
          <div className="pveg-mutation-banner">
            <span>{PVE_MUTATION_ICON[encounter.mutationType]}</span>
            <span>{PVE_MUTATION_LABEL[encounter.mutationType]}</span>
          </div>
        )}

        <div className="layout">
          <section>
            <div className="pveg-bars">
              {/* DUEL關（第4/8關）沒有BossHP/傷害概念，不渲染HP條，改顯示手數與
                  「輪到誰」提示（documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §5.2）。 */}
              {!isDuel && (
                <div className={`pveg-boss-hp${bossHpPct < 25 ? " low" : ""}`}>
                  <div className="pveg-bar-label">
                    <span>Boss HP</span>
                    <span>
                      {encounter.bossHpCurrent} / {encounter.bossHpMax}
                    </span>
                  </div>
                  <div className="pveg-bar-track">
                    <div className="pveg-bar-fill" style={{ width: `${bossHpPct}%` }} />
                  </div>
                </div>
              )}
              <div className={`pveg-move-budget${movePct < 20 ? " low" : ""}`}>
                <div className="pveg-bar-label">
                  <span>{isDuel ? "剩餘手數（你的落子）" : "剩餘手數"}</span>
                  <span>
                    {remainingMoves} / {encounter.moveBudget}
                  </span>
                </div>
                <div className="pveg-bar-track">
                  <div className="pveg-bar-fill" style={{ width: `${movePct}%` }} />
                </div>
              </div>
              {isDuel && (
                <p className="dim" style={{ fontSize: 12 }} data-testid="pve-duel-turn-hint">
                  黑子（你）先手，白子（Boss）後手，連五即分出勝負
                </p>
              )}
            </div>

            <div className={`pveg-board-wrap${fxClass ? ` ${fxClass}` : ""}`}>
              <PveBoard
                rows={encounter.boardRows}
                cols={encounter.boardCols}
                stones={encounter.stones}
                obstacles={encounter.obstacles}
                fieldType={encounter.fieldType}
                pendingCell={pendingCell}
                skillPreviewCells={skillPreviewCells}
                bossLastMove={bossLastMove}
                bossSkillCells={bossSkillCells}
                horizontalDisabled={encounter.horizontalDisabled}
                voidLineCells={voidLineCells}
                interactive={boardInteractive}
                skillFlowActive={!!skillFlow}
                onCellClick={onBoardCellClick}
              />
              <div className="pveg-dmg-layer" data-testid="pve-dmg-layer">
                {damageFloats.map((f) => (
                  <div key={f.id} className="pveg-dmg-float">
                    {f.text}
                    <span className="sub">{f.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pveg-confirm-bar" aria-live="polite">
              {skillFlow ? (
                skillFlow.stage === "direction" ? (
                  <div className="dir-pad">
                    {PVE_SKILL_DIRECTIONS[skillFlow.skillType].map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        className="btn"
                        onClick={() => pickSkillDirection(dir)}
                      >
                        {PVE_DIR_LABEL[dir]}
                      </button>
                    ))}
                    <button type="button" className="btn btn-ghost" onClick={cancelSkillFlow}>
                      取消
                    </button>
                  </div>
                ) : skillFlow.stage === "ready" ? (
                  <>
                    <span className="dim" style={{ fontSize: 12 }}>
                      {SKILL_NAME_ZH[skillFlow.skillType]} 已選定座標
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={confirmSkill}
                      data-testid="confirm-skill-btn"
                    >
                      確認使用技能
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={cancelSkillFlow}>
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <span className="dim" style={{ fontSize: 12 }}>
                      {skillFlow.mode === "axis" && "請點選棋盤上一格作為推擠參考格（可為空格或現有棋子）"}
                      {skillFlow.mode === "ultimate" && "請點選棋盤上的空格作為大絕錨點"}
                      {skillFlow.mode === "target" && "請點選棋盤上一顆現存棋子作為目標"}
                      {skillFlow.mode === "scatter" &&
                        (skillFlow.stage === "first" ? "請點選第一個空格" : "請點選第二個空格（需距第一點至少2格）")}
                    </span>
                    <button type="button" className="btn btn-ghost" onClick={cancelSkillFlow}>
                      取消
                    </button>
                  </>
                )
              ) : pendingCell ? (
                <>
                  <span className="dim" style={{ fontSize: 12 }}>
                    已選第 {pendingCell.row} 列、第 {pendingCell.col} 欄
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={confirmMove}
                    data-testid="confirm-move-btn"
                  >
                    確認落子
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={cancelPending}>
                    取消
                  </button>
                </>
              ) : (
                <span className="dim" style={{ fontSize: 12 }}>
                  {encounter.status === "IN_PROGRESS" ? "點擊棋盤選擇落子位置，再按確認落子" : ""}
                </span>
              )}
            </div>

            {(encounter.fieldType === "VOLCANO" || encounter.fieldType === "BEACH") && (
              <div className="pveg-field-legend">
                {encounter.fieldType === "VOLCANO" && (
                  <span>
                    <span className="sw pveg-sw-obstacle" />
                    障礙格（禁止落子）
                  </span>
                )}
                {encounter.fieldType === "BEACH" && (
                  <>
                    <span>
                      <span className="sw pveg-sw-ocean" />
                      海洋（可正常落子）
                    </span>
                    <span>
                      <span className="sw pveg-sw-sand" />
                      沙灘
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="card pad mt-16">
              <h3 style={{ marginBottom: 8 }}>技能</h3>
              <div className="skill-bar">
                {heldSkills.length === 0 && <span className="dim">目前未持有任何技能</span>}
                {heldSkills.map((s) => {
                  const disabled =
                    busy ||
                    encounter.status !== "IN_PROGRESS" ||
                    !encounter.skillUsableThisInterval ||
                    (!!skillFlow && skillFlow.skillType !== s.skillType);
                  const active = skillFlow?.skillType === s.skillType;
                  return (
                    <button
                      key={s.skillType}
                      type="button"
                      className={`skill-btn pveg-skill-btn${active ? " active" : ""}`}
                      disabled={disabled}
                      onClick={() => onSkillButtonClick(s.skillType)}
                      data-testid={`skill-btn-${s.skillType}`}
                    >
                      {SKILL_NAME_ZH[s.skillType]}
                      <span className="pveg-skill-qty">{s.quantity}</span>
                      {encounter.usedSkills.includes(s.skillType) && (
                        <span className="pveg-skill-used-mark">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {!encounter.skillUsableThisInterval && encounter.status === "IN_PROGRESS" && (
                <p className="dim mt-8" style={{ fontSize: 12 }}>
                  本間隔已使用過技能，落子後可再次使用
                </p>
              )}
            </div>
          </section>

          <aside className="sidebar">
            <div className="card pad">
              <h3>本關戰況</h3>
              <p className="dim mt-8" style={{ fontSize: 13 }}>
                本關已造成傷害：{encounterDamageDealt(encounter)}
              </p>
              <p className="dim" style={{ fontSize: 13 }}>
                本關已使用技能：{usedSkillLabels.length ? usedSkillLabels.join("、") : "無"}
              </p>
              {bossUsedSkillLabels.length > 0 && (
                <p className="dim" style={{ fontSize: 13 }}>
                  魔王已使用技能：{bossUsedSkillLabels.join("、")}
                </p>
              )}
            </div>
            <div className="card pad">
              <h3>持有遺物</h3>
              <div className="pveg-relic-list mt-8">
                {heldRelics.length === 0 && <span className="dim">無</span>}
                {heldRelics.map((r, i) => (
                  <span key={i} className="pveg-relic-chip">
                    {PVE_RELIC_INFO[r.relicType].name}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {confirmAbandon && (
        <Modal dismissable={!busy} onClose={() => setConfirmAbandon(false)}>
          <h2>確定要放棄本次挑戰？</h2>
          <p className="dim mt-8">放棄視同本次挑戰失敗，目前的 Run 將會終止並無法復原。</p>
          <div className="row gap-8 mt-16">
            <button type="button" className="btn btn-danger" disabled={busy} onClick={doAbandon}>
              確定放棄
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setConfirmAbandon(false)}
            >
              取消
            </button>
          </div>
        </Modal>
      )}

      {showStrategyCard && strategyCard && !outcome && (
        <PveStrategyCard
          card={strategyCard}
          initialStones={isDuel ? [] : encounter.stones}
          onStart={() => setShowStrategyCard(false)}
        />
      )}

      {outcome && (
        <Modal dismissable={false}>
          <h2 className={outcome.kind === "cleared" ? "" : "dim"} data-testid="pve-outcome-title">
            {outcome.reasonText ?? (outcome.kind === "cleared" ? "關卡通過！" : "挑戰失敗")}
          </h2>
          {!isDuel && (
            <div className="pveg-outcome-stats">
              <div>
                <b>{outcome.damage}</b>
                <span className="dim">本關造成傷害</span>
              </div>
              <div>
                <b>{usedSkillLabels.length}</b>
                <span className="dim">已使用技能種類</span>
              </div>
            </div>
          )}
          <p className="dim" style={{ fontSize: 13, textAlign: "center" }}>
            已使用技能：{usedSkillLabels.length ? usedSkillLabels.join("、") : "無"}
          </p>
          {outcome.kind === "draw" && (
            <>
              <p className="dim mt-8" style={{ fontSize: 13, textAlign: "center" }}>
                手數已用盡，雙方皆未連五——這不算你輸，本關可無限次重試。
              </p>
              <div className="row gap-8 mt-16" style={{ justifyContent: "center" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={retrying}
                  onClick={retryDrawnEncounter}
                  data-testid="pve-draw-retry-btn"
                >
                  再來一局
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
