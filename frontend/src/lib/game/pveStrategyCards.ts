/**
 * 策略卡資料（documents/PVE-全對弈階梯設計-2026-07-10.md §6「策略卡八關重寫」）：
 * 每關一張，關卡載入、棋盤尚未可互動前顯示（`interactive=false` 期間），複用
 * `PveBoard.tsx` 既有的 `interactive` prop 做「開始」前的鎖定。全8關皆為對弈
 * （DUEL），`highlightMode` 全面改為 `"duel-tips"`——舊消線關卡的
 * `"initial-stones"` 模式隨消線退役（§8 拆除清單），型別仍保留該字面值供
 * `PveStrategyCard.tsx` 既有分支相容，但資料表不再使用它。
 */
/**
 * L2/L3/L7/L8限定，開局示意棋盤上的一顆棋子（5x5相對格局，中心(2,2)）。
 * `scripted:true`＝後端 BossAiPolicy.openingMove 實際腳本化的手（黑1＝玩家
 * 自由第一手的示意起點；白2＝Boss依花月/浦月腳本相對黑1的真實位形）；
 * `scripted:false`＝純示意延伸（黑3，讓玩家對照「花月/浦月」這個開局名字
 * 想像後續棋形走向，非後端強制腳本）。
 */
export interface PveOpeningPreviewStone {
  row: number;
  col: number;
  color: "BLACK" | "WHITE";
  label: string;
  scripted: boolean;
}

export interface PveStrategyCard {
  sequence: number;
  patternName: string;
  tagline: string;
  highlightMode: "initial-stones" | "duel-tips";
  /** L2/L3/L7/L8限定：開局定式名（花月/浦月）。 */
  openingName?: string;
  /** L2/L3/L7/L8限定：前3手示意棋盤（見 PveOpeningPreviewStone 註解）。 */
  openingPreview?: PveOpeningPreviewStone[];
}

const HUAYUE_PREVIEW: PveOpeningPreviewStone[] = [
  { row: 2, col: 2, color: "BLACK", label: "黑1", scripted: true },
  { row: 3, col: 2, color: "WHITE", label: "白2", scripted: true },
  { row: 1, col: 2, color: "BLACK", label: "黑3", scripted: false },
];

const PUYUE_PREVIEW: PveOpeningPreviewStone[] = [
  { row: 2, col: 2, color: "BLACK", label: "黑1", scripted: true },
  { row: 3, col: 3, color: "WHITE", label: "白2", scripted: true },
  { row: 1, col: 1, color: "BLACK", label: "黑3", scripted: false },
];

export const PVE_STRATEGY_CARDS: Record<number, PveStrategyCard> = {
  1: {
    sequence: 1,
    patternName: "基本擋衝四",
    tagline: "入門魔王幾乎不會擋——但你自己要先認得『四缺一』的樣子，練習主動補完",
    highlightMode: "duel-tips",
  },
  2: {
    sequence: 2,
    patternName: "做活三",
    tagline: "見習偶爾走神——抓住它漏擋的瞬間，把你的活三推成活四，它擋不完兩端",
    highlightMode: "duel-tips",
    openingName: "花月",
    openingPreview: HUAYUE_PREVIEW,
  },
  3: {
    sequence: 3,
    patternName: "縱斜思維",
    tagline: "這關橫向連五不算數——雙方都是。把你的活三活四都往縱線、斜線去經營，橫向的子只能拿來牽制，贏不了",
    highlightMode: "duel-tips",
    openingName: "花月",
    openingPreview: HUAYUE_PREVIEW,
  },
  4: {
    sequence: 4,
    patternName: "雙威脅",
    tagline: "精英魔王會主動做雙威脅，也會預判你的活三——搶在它完成雙線之前，先做出你自己的",
    highlightMode: "duel-tips",
  },
  5: {
    sequence: 5,
    patternName: "地形利用",
    tagline: "岩石從一開局就卡在盤面上，雙方都不能下——把它當成你規劃連線的邊界，不是敵人的武器",
    highlightMode: "duel-tips",
  },
  6: {
    sequence: 6,
    patternName: "浪潮節奏",
    tagline: "每十手，浪會把雙方的棋子一起往岸推——記得在推浪前確認你的活四還連得住，推完再算一次",
    highlightMode: "duel-tips",
  },
  7: {
    sequence: 7,
    patternName: "完整攻防",
    tagline: "真魔王恆定不留漏洞、必做雙威脅——用強制手順把它逼到只能擋一邊",
    highlightMode: "duel-tips",
    openingName: "浦月",
    openingPreview: PUYUE_PREVIEW,
  },
  8: {
    sequence: 8,
    patternName: "反技能",
    tagline: "真魔王這次帶了弓箭手的技能：小心它狙擊你的活三中間那顆子、散射搶兩線、或用開拓之星直接清你的雙威脅——每個技能它只有一次，逼它用掉就安全了",
    highlightMode: "duel-tips",
    openingName: "浦月",
    openingPreview: PUYUE_PREVIEW,
  },
};

export function strategyCardFor(sequence: number): PveStrategyCard | null {
  return PVE_STRATEGY_CARDS[sequence] ?? null;
}
