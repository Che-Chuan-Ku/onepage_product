"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { PveBoard } from "@/components/pve-game/PveBoard";
import { pveService } from "@/lib/api/pve";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/lib/store/toast";
import {
  PVE_DIR_LABEL,
  PVE_FIELD_LABEL,
  PVE_MUTATION_ICON,
  PVE_MUTATION_LABEL,
  PVE_SKILL_DIRECTIONS,
  buildSkillRequest,
  presentPveEvent,
  scatterDistanceOk,
  skillFlowPreviewCells,
  startSkillFlow,
  type PveSkillFlow,
} from "@/lib/game/pveBoard";
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
  const [sessionDamage, setSessionDamage] = useState(0);

  const [pendingCell, setPendingCell] = useState<Cell | null>(null);
  const [skillFlow, setSkillFlow] = useState<PveSkillFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const [damageFloats, setDamageFloats] = useState<DamageFloat[]>([]);
  const [fxClass, setFxClass] = useState<string>("");
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [outcome, setOutcome] = useState<null | { kind: "cleared" | "failed"; damage: number }>(
    null,
  );

  // ── load: refresh 直接重拉 encounter 續玩 (增量需求 持久化與續玩) ──
  useEffect(() => {
    let cancelled = false;
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
    if (enc.lastResolution) {
      setSessionDamage((d) => d + enc.lastResolution!.damageDealt);
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
    }
  }

  function handleCleared(enc: PveEncounterStateResponse) {
    setOutcome({ kind: "cleared", damage: sessionDamage + (enc.lastResolution?.damageDealt ?? 0) });
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
    const encDamage = sessionDamage + (enc.lastResolution?.damageDealt ?? 0);
    setOutcome({ kind: "failed", damage: encDamage });
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
    if (skillFlow.mode === "axis") {
      setSkillFlow({ ...skillFlow, direction: dir, stage: "ready" });
    } else if (skillFlow.mode === "ultimate") {
      setSkillFlow({ ...skillFlow, direction: dir, stage: "anchor" });
    }
  }

  function onSkillCellClick(row: number, col: number) {
    if (!skillFlow || !encounter) return;
    const stoneHit = encounter.stones.some((s) => s.row === row && s.col === col);
    const obstacleHit = encounter.obstacles.some((o) => o.row === row && o.col === col);
    if (skillFlow.mode === "ultimate" && skillFlow.stage === "anchor") {
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
  // 本關已使用技能改讀權威 PveEncounterStateResponse.usedSkills（FR-B7），不再
  // 本地追蹤／存 sessionStorage。
  const usedSkillLabels = useMemo(
    () => (encounter?.usedSkills ?? []).map((s) => SKILL_NAME_ZH[s]),
    [encounter],
  );
  const boardInteractive =
    !!encounter && encounter.status === "IN_PROGRESS" && !busy && !outcome;

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
              <div className={`pveg-move-budget${movePct < 20 ? " low" : ""}`}>
                <div className="pveg-bar-label">
                  <span>剩餘手數</span>
                  <span>
                    {remainingMoves} / {encounter.moveBudget}
                  </span>
                </div>
                <div className="pveg-bar-track">
                  <div className="pveg-bar-fill" style={{ width: `${movePct}%` }} />
                </div>
              </div>
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
                interactive={boardInteractive}
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
                本關已造成傷害：{sessionDamage}
              </p>
              <p className="dim" style={{ fontSize: 13 }}>
                本關已使用技能：{usedSkillLabels.length ? usedSkillLabels.join("、") : "無"}
              </p>
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

      {outcome && (
        <Modal dismissable={false}>
          <h2 className={outcome.kind === "cleared" ? "" : "dim"}>
            {outcome.kind === "cleared" ? "關卡通過！" : "挑戰失敗"}
          </h2>
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
          <p className="dim" style={{ fontSize: 13, textAlign: "center" }}>
            已使用技能：{usedSkillLabels.length ? usedSkillLabels.join("、") : "無"}
          </p>
        </Modal>
      )}
    </>
  );
}
