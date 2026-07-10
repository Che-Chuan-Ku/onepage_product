"use client";

import { Modal } from "@/components/Modal";
import type {
  PveOpeningPreviewStone,
  PveStrategyCard as PveStrategyCardData,
} from "@/lib/game/pveStrategyCards";
import type { Cell } from "@/lib/types/schemas";

interface PveStrategyCardProps {
  card: PveStrategyCardData;
  /** 消線關（highlightMode:"initial-stones"）示意用：本局實際的預放黑棋座標
   * （同一份 PveEncounterStateResponse.stones，與正式棋盤共用資料，避免因
   * D4 隨機變換讓「策略卡畫的形狀」跟「棋盤實際擺的形狀」對不上，§2.2）。 */
  initialStones: Cell[];
  onStart: () => void;
}

/**
 * 策略卡進場展示（documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §2.2/§2.3）：
 * 關卡載入、棋盤尚未可互動前顯示；玩家按「開始」後才把 `interactive` 打開
 * （複用 PveBoard.tsx 既有的 interactive prop，見呼叫端）。
 */
export function PveStrategyCard({ card, initialStones, onStart }: PveStrategyCardProps) {
  return (
    <Modal dismissable={false}>
      <h2 data-testid="pve-strategy-card-title">
        第 {card.sequence} 關 · {card.patternName}
      </h2>
      <p className="dim mt-8" style={{ fontSize: 14, lineHeight: 1.6 }} data-testid="pve-strategy-card-tagline">
        {card.tagline}
      </p>
      {card.highlightMode === "initial-stones" && initialStones.length > 0 && (
        <p className="dim mt-8" style={{ fontSize: 12 }}>
          棋盤上已預放 {initialStones.length} 顆黑子——開始後對照棋盤找出這個棋形。
        </p>
      )}
      {card.highlightMode === "duel-tips" && (
        <>
          <p className="dim mt-8" style={{ fontSize: 12 }}>
            魔王對弈：黑子（你）先手，白子（Boss）後手，連五即勝負判定。
          </p>
          {card.openingName && card.openingPreview && (
            <OpeningPreview name={card.openingName} stones={card.openingPreview} />
          )}
        </>
      )}
      <div className="row gap-8 mt-16">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onStart}
          data-testid="pve-strategy-card-start-btn"
        >
          開始
        </button>
      </div>
    </Modal>
  );
}

// ── 開局定式示意圖（L4花月/L8浦月，2026-07-09補充，§1.4/§2.3）──────────────
// 5x5相對格局迷你棋盤（非正式11x11棋盤的縮圖，只是拿來畫「花月/浦月」這個
// 開局定式名字對應的相對位形——正式對局中玩家第一手座標是自由選的，不是
// 這張圖上的固定絕對座標）。

const PREVIEW_GRID = 5;
const PREVIEW_CELL = 28;
const PREVIEW_SIZE = PREVIEW_CELL * (PREVIEW_GRID - 1) + PREVIEW_CELL;
const PREVIEW_STONE_R = 10;

function OpeningPreview({ name, stones }: { name: string; stones: PveOpeningPreviewStone[] }) {
  const toPx = (v: number) => PREVIEW_CELL / 2 + v * PREVIEW_CELL;
  return (
    <div className="mt-16" data-testid="pve-opening-preview">
      <p className="dim" style={{ fontSize: 12, marginBottom: 6 }}>
        開局定式：<b>{name}</b>——黑1／白2 為魔王實際會走的第一手；黑3 為示意延伸，
        讓你想像這個定式接下來的棋形，非強制腳本。
      </p>
      <svg
        width={PREVIEW_SIZE}
        height={PREVIEW_SIZE}
        viewBox={`0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`}
        role="img"
        aria-label={`${name}開局前三手示意圖`}
        style={{ display: "block", margin: "0 auto" }}
      >
        <rect width={PREVIEW_SIZE} height={PREVIEW_SIZE} fill="var(--pve-preview-bg, #d8b878)" rx={4} />
        {Array.from({ length: PREVIEW_GRID }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={toPx(0)}
            y1={toPx(i)}
            x2={toPx(PREVIEW_GRID - 1)}
            y2={toPx(i)}
            stroke="#5a4423"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: PREVIEW_GRID }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={toPx(i)}
            y1={toPx(0)}
            x2={toPx(i)}
            y2={toPx(PREVIEW_GRID - 1)}
            stroke="#5a4423"
            strokeWidth={1}
          />
        ))}
        {stones.map((s) => (
          <g key={s.label}>
            <circle
              cx={toPx(s.col)}
              cy={toPx(s.row)}
              r={PREVIEW_STONE_R}
              fill={s.color === "BLACK" ? "#1a1a1a" : "#f5f5f5"}
              stroke={s.scripted ? "#c0392b" : "#888"}
              strokeWidth={s.scripted ? 2 : 1}
              strokeDasharray={s.scripted ? undefined : "3,2"}
            />
            <text
              x={toPx(s.col)}
              y={toPx(s.row)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fill={s.color === "BLACK" ? "#f5f5f5" : "#1a1a1a"}
            >
              {s.label.replace(/^[黑白]/, "")}
            </text>
          </g>
        ))}
      </svg>
      <p className="dim" style={{ fontSize: 11, textAlign: "center", marginTop: 4 }}>
        實線圈＝實際腳本手（黑1/白2）　虛線圈＝示意延伸（黑3）
      </p>
    </div>
  );
}
