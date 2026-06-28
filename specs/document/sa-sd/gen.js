const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, TableOfContents, PageBreak, PageNumber,
  Header, Footer,
} = require("docx");

const OUT = "/Users/chechuanku/Documents/aiproject/gomoku/specs/document/sa-sd/系統分析暨設計書.docx";

// ---- helpers ----
const FONT = "Microsoft JhengHei"; // 繁中字型，fallback Arial
const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const cb = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] }); }
function h4(t) { return new Paragraph({ heading: HeadingLevel.HEADING_4, children: [new TextRun(t)] }); }
function h5(t) { return new Paragraph({ heading: HeadingLevel.HEADING_5, children: [new TextRun(t)] }); }
function p(t) { return new Paragraph({ spacing: { after: 120 }, children: [new TextRun(t)] }); }
function bullet(t) { return new Paragraph({ numbering: { reference: "blist", level: 0 }, children: [new TextRun(t)] }); }
function num(ref, t) { return new Paragraph({ numbering: { reference: ref, level: 0 }, children: [new TextRun(t)] }); }
function caption(t) { return new Paragraph({ spacing: { before: 80, after: 60 }, children: [new TextRun({ text: t, bold: true, size: 22 })] }); }
function note(t) { return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, italics: true, size: 20, color: "555555" })] }); }

function mermaid(lines) {
  // render code as monospaced shaded paragraphs
  return lines.map((ln, i) => new Paragraph({
    shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
    spacing: { before: i === 0 ? 60 : 0, after: i === lines.length - 1 ? 120 : 0 },
    children: [new TextRun({ text: ln === "" ? " " : ln, font: "Courier New", size: 18 })],
  }));
}

function tbl(widths, header, rows, highlightRows) {
  highlightRows = highlightRows || [];
  const mkCell = (text, isHead, w, fill) => new TableCell({
    borders: cb,
    width: { size: w, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: isHead ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: !!isHead, size: 20 })],
    })],
  });
  const trows = [];
  trows.push(new TableRow({
    tableHeader: true,
    children: header.map((hh, i) => mkCell(hh, true, widths[i], "D5E8F0")),
  }));
  rows.forEach((r) => {
    trows.push(new TableRow({
      children: r.map((c, i) => mkCell(c, false, widths[i], undefined)),
    }));
  });
  return new Table({ columnWidths: widths, margins: { top: 60, bottom: 60, left: 120, right: 120 }, rows: trows });
}

// equal width helpers (9360 usable)
const W = (n) => { const each = Math.floor(9360 / n); return Array(n).fill(each); };

const children = [];

// ===== 封面 =====
children.push(new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "個人專案（無委託方）", size: 28 })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
  children: [new TextRun({ text: "五子棋對戰平台（Gomoku Platform）", bold: true, size: 36 })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: "系統分析暨設計文件", bold: true, size: 52 })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: "版號 V1.0.0", size: 28 })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: "執行廠商：古哲銓（個人開發）", size: 24 })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: "中華民國一一五年六月", size: 24 })] }));

// ===== 版本異動紀錄 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_2, children: [new TextRun("版本異動紀錄")] }));
children.push(tbl(W(7),
  ["版本", "修訂日期", "修訂章節", "修訂說明", "修訂人", "審核人", "審核日期"],
  [["V1.0.0", "2026/06/18", "全", "初版", "古哲銓", "古哲銓（自審）", "2026/06/18"]]));

// ===== 目錄 / 圖目錄 / 表目錄 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_2, children: [new TextRun("文件目錄")] }));
children.push(new TableOfContents("文件目錄", { hyperlink: true, headingStyleRange: "1-5" }));
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_2, children: [new TextRun("圖目錄")] }));
children.push(p("圖 1：使用者管理"));
children.push(p("圖 2：本地雙人對戰"));
children.push(p("圖 3：線上連線對戰"));
children.push(p("圖 4：系統架構圖"));
children.push(p("圖 5：資料表關聯圖"));
children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("表目錄")] }));
children.push(p("表 1：需求追溯表"));
children.push(p("表 2：功能清單"));
children.push(p("表 3：技術選用"));
children.push(p("表 4：錯誤代碼表"));
children.push(p("表 5：API 清單"));
children.push(p("表 6：資料表清單"));

// ===== 壹、文件治理 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun("壹、文件治理")] }));
children.push(h2("一、版號規則"));
children.push(tbl([1872, 7488], ["版號規則", "說明"], [
  ["1", "第一碼固定為 v，以點號分隔後續版本。"],
  ["2", "第一個數字為主版本，以 0 開始，定版後為 1，後續為系統階段變更。"],
  ["3", "第二個數字為新功能、流程、項目加入，以 0 開始。"],
  ["4", "第三個數字為修正、補述、勘誤，以 0 開始。"],
]));
children.push(h2("二、文件狀態"));
children.push(p("本文件目前狀態為「初版（Draft）」，適用於「五子棋對戰平台」專案。本平台之需求規格已完成需求分析與品質閘門檢核（四視圖一致性掃描通過、缺漏與待澄清事項歸零），後端開發、前端開發與整合測試均已完成，本文件依據已定版之規格 artifacts 排版產出。"));
children.push(h2("三、適用範圍"));
children.push(p("本文件涵蓋五子棋對戰平台之系統分析與設計，包含下列三條主要業務流程及其相關功能："));
children.push(bullet("使用者管理流程：註冊、登入取得 JWT、訪客模式進入、個人戰績與排行榜查詢。"));
children.push(bullet("本地雙人對戰流程：同裝置輪流落子、可選 Swap2 開局、對局結束與再戰重置。"));
children.push(bullet("線上連線對戰流程：建立／加入房間、快速配對、房內準備與聊天、投擲硬幣決定先手、Swap2 開局放置與選擇、線上即時落子、連線管理與斷線判負、對局歷史與回放。"));
children.push(p("本文件不涵蓋下列項目："));
children.push(bullet("與本平台無關之第三方系統介接（本平台無外部 SSO 或第三方金流／通知整合）。"));
children.push(bullet("部署環境之實際機房、網路拓樸與運維作業手冊（屬維運文件範疇）。"));
children.push(bullet("AI 對局、排位賽季、社群好友等規格中未定義之延伸功能。"));
children.push(h2("四、維護單位與引用文件清單"));
children.push(p("本文件由古哲銓（以下簡稱本團隊）撰寫與維護；本平台為個人專案，本文件交付對象為專案維護人員、後端／前端開發者及自我稽核之用。本文件之內容係依據下列上游規格文件忠實轉譯排版（完整清單見柒、附錄引用）："));
children.push(bullet("需求活動圖（specs/activities/*.mmd）。"));
children.push(bullet("驗收規格（specs/features/**/*.feature，Gherkin）。"));
children.push(bullet("API 契約（specs/api.yml，OpenAPI 3.0.0）。"));
children.push(bullet("資料模型（specs/erm.dbml，DBML）。"));
children.push(bullet("角色定義（specs/actors/*.md）與介面定義（specs/ui/*.md）。"));
children.push(p("維護單位聯絡窗口與電子郵件：古哲銓，chechuanku@gmail.com。"));

// ===== 貳、前言 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun("貳、前言")] }));
children.push(h2("一、系統說明"));
children.push(p("本系統為「五子棋對戰平台」（以下簡稱本平台），係一套提供使用者於網頁端進行五子棋對弈之線上服務。本平台為個人專案，由古哲銓（以下簡稱本團隊）獨力規劃、分析與設計，採前後端分離架構：後端以 Java Spring Boot 提供伺服器權威之 REST API 與即時對局服務，前端以 Next.js／React 提供響應式網頁介面。"));
children.push(p("本平台主要目的為提供「低門檻、即時、可回顧」的五子棋對戰體驗：使用者可註冊帳號累積跨場戰績並登上排行榜，亦可以訪客身份免註冊即刻遊玩；支援同裝置之本地雙人對戰，以及透過房間配對之線上即時對戰；並提供標準 Swap2 開局規則、硬幣投擲先手、對局歷史與回放等進階功能。所有落子合法性與勝負判定均由後端權威驗證，確保線上對局之公平性與一致性。"));
children.push(h2("二、文件目的"));
children.push(p("本文件為五子棋對戰平台之系統分析與設計文件，內容包含系統分析（需求追溯、功能清單與功能流程）、安全與合規規劃、系統設計（系統架構、技術選用、API 規格與資料表結構）、測試與驗收重點，以及附錄引用文件清單，供專案管理、開發、測試與稽核之依據。"));
children.push(h2("三、名詞說明"));
[
  ["本平台", "五子棋對戰平台（Gomoku Platform），即本文件所描述之系統。"],
  ["註冊玩家（RegisteredPlayer）", "透過 Email／Username 加密碼註冊並登入之使用者，登入後由系統發放 JWT 作為身份憑證，其對戰結果計入個人戰績與排行榜。"],
  ["訪客玩家（GuestPlayer）", "未註冊、輸入暱稱即可遊玩之使用者；本地模式全功能支援，線上模式僅限單場且不累積戰績。"],
  ["JWT（JSON Web Token）", "登入成功後核發之身份憑證，用於後續需驗證之請求。"],
  ["Swap2", "一種標準五子棋開局平衡規則。假先方依「黑·白·黑」順序放置開局三子，假後方再三選一（執黑、執白、或放第四·五子後再由對手選色），以平衡先手優勢。"],
  ["假先方（tentative-first）", "Swap2 開局中先放置開局三子之一方。"],
  ["假後方", "Swap2 開局中後做三選一決定之一方。"],
  ["對戰席（PLAYER）", "房間內參與落子與 Ready 之席位，每房上限 2 席。"],
  ["觀戰席（SPECTATOR）", "對戰席已滿後加入者之唯讀角色，不可落子、不參與 Ready。"],
  ["STOMP over WebSocket", "本平台即時通訊協定，用於對局狀態廣播、開局同步與房內聊天。"],
  ["伺服器權威（Server-authoritative）", "所有落子與勝負判定均必經後端，前端僅負責呈現。"],
  ["長連算勝、無禁手", "本平台勝負規則，五子或以上同色連線（含六連以上長連）即判勝，且不設禁手限制。"],
].forEach(([t, d]) => children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t + "：", bold: true }), new TextRun(d)] })));

// ===== 參、系統分析 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun("參、系統分析")] }));
children.push(h2("一、需求追溯表"));
children.push(caption("表 1：需求追溯表"));
children.push(tbl([2400, 1100, 2200, 2200, 1460],
  ["原始需求", "模組", "功能", "補充說明", "對應流程圖"],
  [
    ["需求 #1（註冊帳號.feature）", "使用者", "註冊帳號", "username／email 唯一、密碼規則", "圖 1．使用者管理"],
    ["需求 #1（登入取得JWT.feature）", "使用者", "登入取得 JWT", "帳密驗證、核發 JWT", "圖 1．使用者管理"],
    ["需求 #2（訪客模式進入.feature）", "使用者", "訪客模式進入", "非空暱稱、臨時身份、線上限單場", "圖 1．使用者管理"],
    ["需求 #3（查看戰績與排行榜.feature）", "使用者", "戰績與排行榜", "主鍵 wins、次鍵 winRate、門檻 10 場", "圖 1．使用者管理"],
    ["需求 #13 #11（本地落子.feature）", "對局", "本地雙人落子", "15×15、輪流、五連判勝", "圖 2．本地雙人對戰"],
    ["需求 #13 #25（開始本地遊戲.feature）", "對局", "開始本地遊戲", "可選 Swap2，假先方系統隨機", "圖 2．本地雙人對戰"],
    ["需求 #14（本地再戰重置.feature）", "對局", "本地再戰與重置", "清盤、保留玩家名稱", "圖 2．本地雙人對戰"],
    ["需求 #5 #26（建立房間.feature）", "房間", "建立房間", "唯一房間碼、公開／私人、可選 Swap2", "圖 3．線上連線對戰"],
    ["需求 #5（加入房間.feature）", "房間", "加入房間", "對戰席滿則轉觀戰者", "圖 3．線上連線對戰"],
    ["需求 #6（快速配對.feature）", "房間", "快速配對", "佇列配對、60 秒逾時退出", "圖 3．線上連線對戰"],
    ["需求 #7 #26（標記準備與聊天.feature）", "房間", "準備與聊天", "雙方 Ready 觸發開局、房內聊天", "圖 3．線上連線對戰"],
    ["需求 #8 #19 #27（投擲硬幣決定先手.feature）", "對局", "投擲硬幣決定先手／假先方", "後端決定結果、前端僅播動畫", "圖 3．線上連線對戰"],
    ["需求 #24 #28 #31（Swap2開局放置.feature）", "開局", "Swap2 開局放置", "黑·白·黑、每子確認、悔最後一子", "圖 3．線上連線對戰"],
    ["需求 #28 #29 #30（Swap2選擇.feature）", "開局", "Swap2 假後方選擇", "三選一、定案黑白與輪次", "圖 3．線上連線對戰"],
    ["需求 #9 #11 #16 #20（線上落子.feature）", "對局", "線上即時落子", "伺服器權威驗證、廣播、長連算勝", "圖 3．線上連線對戰"],
    ["需求 #15 #21（連線管理與斷線判負.feature）", "連線", "連線管理與斷線判負", "心跳 2 秒、斷線 6 秒、寬限 30 秒", "圖 3．線上連線對戰"],
    ["需求 #17 #32（查看遊戲歷史與回放.feature）", "歷史", "遊戲歷史與回放", "完整落子序列含開局子", "圖 1．使用者管理"],
  ]));
children.push(h2("二、功能說明"));
children.push(p("本平台依業務領域劃分為使用者、房間、對局、開局、連線與歷史等模組，涵蓋從帳號管理、房間配對、開局決定、即時對弈到對局回放之完整對戰生命週期。下列功能清單摘要各功能涉及之前端畫面與後端 API 路由，詳細之 API 設計與資料結構分別見伍、系統設計之「API 設計」與「資料表結構」。"));
children.push(h3("（一）功能清單"));
children.push(caption("表 2：功能清單"));
children.push(tbl([1900, 5660, 1800],
  ["名稱", "功能說明", "補充說明"],
  [
    ["註冊帳號", "前端「登入／註冊頁」；後端 POST /auth/register。以 username／email／密碼建立帳號。", "API 設計流程請參閱功能流程章節。"],
    ["登入取得 JWT", "前端「登入／註冊頁」；後端 POST /auth/login。帳密驗證後核發 JWT。", "API 設計流程請參閱功能流程章節。"],
    ["訪客模式進入", "前端「登入／註冊頁」；後端 POST /auth/guest。以非空暱稱建立臨時身份。", "API 設計流程請參閱功能流程章節。"],
    ["查看個人戰績", "前端「戰績與排行榜頁」；後端 GET /players/{playerId}/stats。", "API 設計流程請參閱功能流程章節。"],
    ["查看排行榜", "前端「戰績與排行榜頁」；後端 GET /leaderboard。主鍵 wins、次鍵 winRate。", "API 設計流程請參閱功能流程章節。"],
    ["建立房間", "前端「大廳與房間列表」；後端 POST /rooms。產生唯一房間碼。", "API 設計流程請參閱功能流程章節。"],
    ["公開房間列表", "前端「大廳與房間列表」；後端 GET /rooms。列出 PUBLIC 且 WAITING 房間。", "API 設計流程請參閱功能流程章節。"],
    ["加入房間", "前端「大廳與房間列表」／「房間頁」；後端 POST /rooms/{roomId}/actions/join。", "API 設計流程請參閱功能流程章節。"],
    ["快速配對", "前端「大廳與房間列表」；後端 POST /rooms/actions/quick-match。", "API 設計流程請參閱功能流程章節。"],
    ["切換 Ready", "前端「房間頁」；後端 POST /rooms/{roomId}/actions/toggle-ready。", "API 設計流程請參閱功能流程章節。"],
    ["房內聊天", "前端「房間頁」；即時通道 /topic/room/{roomId}（STOMP）。", "API 設計流程請參閱功能流程章節。"],
    ["開始本地遊戲", "前端「模式選擇首頁」／「棋盤對局頁」；後端 POST /games。", "API 設計流程請參閱功能流程章節。"],
    ["投擲硬幣", "前端「硬幣投擲動畫」；後端 POST /games/{gameId}/actions/coin-toss。", "API 設計流程請參閱功能流程章節。"],
    ["落子", "前端「棋盤對局頁」；後端 POST /games/{gameId}/moves；線上經 /topic/game/{gameId} 廣播。", "API 設計流程請參閱功能流程章節。"],
    ["Swap2 開局放置", "前端「Swap2 開局介面」；後端 POST /games/{gameId}/opening-stones；同步 /topic/game/{gameId}/opening。", "API 設計流程請參閱功能流程章節。"],
    ["悔開局最後一子", "前端「Swap2 開局介面」；後端 POST /games/{gameId}/opening-stones/actions/undo-last。", "API 設計流程請參閱功能流程章節。"],
    ["Swap2 假後方選擇", "前端「Swap2 開局介面」；後端 POST /games/{gameId}/actions/swap2-choice。", "API 設計流程請參閱功能流程章節。"],
    ["再戰", "前端「對局結束畫面」；後端 POST /games/{gameId}/actions/rematch。", "API 設計流程請參閱功能流程章節。"],
    ["取得對局回放", "前端「對局回放頁」；後端 GET /games/{gameId}/replay。", "API 設計流程請參閱功能流程章節。"],
    ["連線管理與斷線判負", "即時通道 STOMP；後端權威心跳偵測與寬限計時（無獨立 REST 端點）。", "API 設計流程請參閱功能流程章節。"],
  ]));
children.push(h3("（二）功能流程"));

children.push(h4("1．使用者管理"));
children.push(caption("圖 1：使用者管理"));
children.push(...mermaid([
  "flowchart TD", "    Start(( ))", "    D2a{進入方式}",
  "    S1[訪客玩家 / 註冊帳號 Email|Username+密碼]", "    S2[訪客玩家 / 登入取得 JWT]",
  "    B2a_guest[訪客玩家 / 輸入暱稱進入(訪客)]", "    S3[註冊玩家 / 查看個人戰績與排行榜]",
  "    End((( )))", "    Start --> D2a", "    D2a -- 註冊登入 --> S1", "    S1 --> S2", "    S2 --> S3",
  "    D2a -- 訪客模式 --> B2a_guest", "    B2a_guest --> End", "    S3 --> End",
]));
children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "流程簡述：", bold: true })] }));
children.push(p("本流程涵蓋使用者進入本平台之兩條身份路徑——註冊登入與訪客模式——以及登入後之戰績查詢。"));
children.push(num("flow1", "註冊登入：使用者以 username、email 與密碼註冊；username 與 email 須唯一、email 格式須合法、密碼至少 8 碼且須同時含英文小寫字母與數字，違反任一前置條件即操作失敗並回傳對應錯誤訊息。註冊成功後系統以雜湊形式儲存密碼並發布 PlayerRegistered 事件。其後以正確帳密登入，系統核發 JWT 並發布 PlayerLoggedIn 事件；帳號不存在或密碼錯誤則回傳「帳號或密碼錯誤」。"));
children.push(num("flow1", "訪客模式：使用者須提供非空暱稱，空暱稱回傳「請輸入暱稱」。進入成功後系統建立臨時玩家身份且不寫入持久帳號資料表；訪客線上遊玩僅限單場、不累積戰績、不進排行榜，且線上單場結束後不可直接再戰，須重新輸入暱稱進新局，並於結束畫面顯示「強烈建議註冊」提示。"));
children.push(num("flow1", "戰績與排行榜：個人戰績包含勝場、敗場、勝率與最近對戰紀錄。排行榜以勝場數（wins）為主排序鍵由高到低，並列時以勝率（winRate）為次鍵；僅累計對局數（勝＋敗）達 10 場之玩家方列入排行榜。"));

children.push(h4("2．本地雙人對戰"));
children.push(caption("圖 2：本地雙人對戰"));
children.push(...mermaid([
  "flowchart TD", "    Start(( ))", "    S1[玩家 / 選擇本地雙人(可勾選啟用Swap2)]", "    D1a{是否啟用 Swap2}",
  "    S2[玩家 / Swap2 開局放置(假先方系統隨機)]", "    S3[玩家 / Swap2 三選一]", "    S4[玩家 / 同裝置輪流落子]",
  "    D4a{對局是否結束}", "    B4a_cont[玩家 / 換手繼續落子]", "    S5[玩家 / 結束畫面(勝者|和局|高亮)]",
  "    S6[玩家 / 再戰|重置(保留玩家名稱)]", "    End((( )))", "    Start --> S1", "    S1 --> D1a",
  "    D1a -- 啟用Swap2 --> S2", "    D1a -- 標準模式 --> S4", "    S2 --> S3", "    S3 --> S4", "    S4 --> D4a",
  "    D4a -- 未結束 --> B4a_cont", "    B4a_cont --> S4", "    D4a -- 五連|和局 --> S5", "    S5 --> S6", "    S6 --> S1", "    S5 --> End",
]));
children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "流程簡述：", bold: true })] }));
children.push(p("本流程為同裝置、無需網路之本地雙人對弈，棋盤為 15×15，採長連算勝、無禁手規則。"));
children.push(num("flow2", "開始遊戲：玩家選擇本地雙人模式，可勾選是否啟用 Swap2。useSwap2 為 false 時直接由黑方先手開始落子；useSwap2 為 true 時系統隨機指派一方為假先方並進入 Swap2 開局。兩種情形皆發布 LocalGameStarted 事件（帶 useSwap2）。"));
children.push(num("flow2", "Swap2 開局（若啟用）：假先方依「黑·白·黑」標準順序放置開局三子，每子確認；放置階段僅允許悔最後放置的一子。完成三子後進入假後方三選一（執黑、執白、或放第四·五子再由對手選色），定案最終黑白與輪次後進入正式對局。"));
children.push(num("flow2", "輪流落子與結束：玩家於同裝置輪流落子，落子位置須在棋盤範圍內且為空位，否則回傳「該位置已有棋子」。合法落子後切換回合並更新棋盤；同色達成五子或以上連線即判該方勝。對局結束顯示結束畫面（勝者／和局、連五高亮），玩家可一鍵再戰，再戰時清空棋盤但保留雙方玩家名稱。"));

children.push(h4("3．線上連線對戰"));
children.push(caption("圖 3：線上連線對戰"));
children.push(...mermaid([
  "flowchart TD", "    Start(( ))", "    S1[玩家 / 選擇線上連線模式]", "    D1a{進入房間方式}",
  "    B1a_create[玩家 / 建立房間(可選Swap2模式)]", "    B1a_join[玩家 / 輸入房間碼加入]", "    B1a_match[玩家 / 快速配對]",
  "    M1a(( ))", "    S2[玩家 / 標記 Ready | 房內聊天]", "    D2a{房間模式 isSwap2Mode}",
  "    S3[玩家 / 投擲硬幣決定黑白(結果後端決定)]", "    S4[玩家 / 投擲硬幣決定假先方(動畫)]",
  "    S5[假先方 / Swap2 開局放置(每子確認+動畫)]", "    S6[假後方 / Swap2 三選一]",
  "    S7[玩家 / 輪流即時落子(後端驗證+廣播)]", "    D7a{對局是否結束}", "    B7a_cont[玩家 / 換手繼續落子]",
  "    S8[玩家 / 結束畫面(勝者|和局|高亮|再戰)]", "    End((( )))",
  "    Start --> S1", "    S1 --> D1a", "    D1a -- 建立房間 --> B1a_create", "    D1a -- 加入房間 --> B1a_join",
  "    D1a -- 快速配對 --> B1a_match", "    B1a_create --> M1a", "    B1a_join --> M1a", "    B1a_match --> M1a",
  "    M1a --> S2", "    S2 --> D2a", "    D2a -- 普通模式 --> S3", "    D2a -- Swap2模式 --> S4",
  "    S3 --> S7", "    S4 --> S5", "    S5 --> S6", "    S6 --> S7", "    S7 --> D7a",
  "    D7a -- 未結束 --> B7a_cont", "    B7a_cont --> S7", "    D7a -- 五連|和局|斷線判負 --> S8", "    S8 --> End",
]));
children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "流程簡述：", bold: true })] }));
children.push(p("本流程為線上即時對弈，自進入房間至對局結束，所有落子與勝負判定均由後端權威驗證，並透過 STOMP over WebSocket 廣播。"));
children.push(num("flow3", "進入房間：玩家可建立房間（產生唯一房間碼、選擇公開／私人與是否啟用 Swap2 模式，建立者即成房內成員）、以房間碼加入既有房間，或使用快速配對。加入房間時，對戰席未滿（上限 2）者成為對戰玩家（PlayerJoinedRoom）；對戰席已滿者自動成為觀戰者（SpectatorJoinedRoom，唯讀，不可落子與 Ready）。快速配對在佇列無對手時進入等待，有等待者時自動配對成局；佇列等待逾 60 秒未配對則退出佇列並提示「排隊過久請重新開始配對」。"));
children.push(num("flow3", "準備與開局決定：房內對戰玩家可切換自己的 Ready 並進行即時聊天。兩名對戰玩家（僅統計 role=PLAYER）皆 Ready 後觸發開局：普通模式進入投擲硬幣決定黑白；Swap2 模式進入投擲硬幣決定假先方。硬幣結果由後端決定、前端僅播放動畫呈現。Swap2 模式下，假先方依標準規則放置開局三子（每子確認並同步雙方，僅假先方可放置、可悔最後一子），假後方再三選一定案最終黑白與輪次。"));
children.push(num("flow3", "即時落子與結束：玩家輪流即時落子，須輪到該玩家且位置合法（在棋盤內、為空位），違反者回傳 InvalidMoveRejected 與對應錯誤（「尚未輪到你」「該位置已有棋子」「落子超出棋盤範圍」）。合法落子後後端記錄並透過 GameStateUpdated 廣播給房內雙方並切換回合；同色達成五子或以上連線判該方勝（長連算勝、無禁手），棋盤填滿無人連線判和局。對局期間以 2 秒心跳偵測連線、連續 6 秒無心跳判定斷線並啟動 30 秒重連寬限：寬限期內重連則恢復對局，逾 30 秒未重連判對手勝，雙方同時斷線且皆逾寬限判和局；對局尚未進入 PLAYING（WAITING／READY／OPENING 階段）即斷線則不判負，僅將該玩家移出對戰席、房間退回等待狀態。"));

// ===== 肆、安全與合規 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun("肆、安全與合規")] }));
children.push(h2("一、密碼管理"));
children.push(p("本平台之帳號密碼由本平台自行管理，未介接外部 SSO 或第三方身份提供者。註冊時密碼須符合下列規則：最短 8 碼，且須同時包含英文小寫字母與數字，允許大小寫字母、數字與符號（不限制更高複雜度）。密碼一律以雜湊形式儲存（對應 players.password_hash），不以明文保存。訪客玩家無 email 與密碼（players.email／players.password_hash 對訪客為 null）。"));
children.push(p("登入採帳密驗證，成功後核發 JWT 作為後續請求之身份憑證；帳號不存在或密碼錯誤時統一回傳「帳號或密碼錯誤」，不區分兩者以降低帳號列舉風險。"));
children.push(h2("二、Log 保留策略"));
children.push(p("本平台之資料模型未定義獨立的安全稽核 log 表（如登入紀錄表、API 呼叫紀錄表）。與對局可追溯性相關之事件流持久化於下列不可變資料表，可作為對局稽核與回放之依據（詳見伍、系統設計之「資料表結構」）："));
children.push(bullet("moves（落子序列）：記錄每一手之序號、顏色、座標與時間，為不可變事件流（免審計欄位），用於對局過程追溯與回放。"));
children.push(bullet("opening_stones（開局子）：記錄 Swap2 開局放置順序、顏色、座標、放置者與時間，為不可變事件流（可被「悔最後一子」物理移除），用於開局重播。"));
children.push(bullet("room_chat_messages（房內聊天訊息）：記錄房間內聊天內容（長度上限 500 字），採軟刪除。"));
children.push(p("上述事件流之保留期限政策統一定為 90 天：對局結束逾 90 天之 moves、opening_stones 與 room_chat_messages 紀錄得依保留政策清理；於保留期內供對局稽核、回放與爭議追溯之用。"));
children.push(h2("三、Token 與 PII 保護"));
children.push(p("權限路徑分類依 API 契約區分為免驗證與需驗證兩類："));
children.push(bullet("免驗證入口：/auth/register、/auth/login、/auth/guest（取得身份／JWT 之入口）。"));
children.push(bullet("需 JWT 驗證：建立／加入房間、快速配對、切換 Ready、落子、開局相關等命令端點；未登入或憑證無效時回傳 401，權限不足（如觀戰者標記 Ready、非假先方放置開局子）時回傳 403。"));
children.push(p("身份憑證採 JWT，由 Spring Security 簽發與驗簽。Token 有效期限與金鑰管理政策如下：Access token 有效期限為 1 小時、Refresh token 為 7 天；簽章演算法採 HS256（HMAC-SHA256），簽章密鑰不入庫、不寫入程式碼，一律由環境變數於執行期注入。個人可識別資訊（PII）方面，本平台僅儲存 players.username、players.email（訪客為 null）與 players.password_hash（雜湊，不可逆），email 與 username 設唯一索引；訪客身份不落持久帳號資料表。"));

// ===== 伍、系統設計 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun("伍、系統設計")] }));
children.push(h2("一、系統架構"));
children.push(h3("（一）整體架構說明"));
children.push(p("本平台採前後端分離之單體式（modular monolith）架構。前端為 Next.js／React 單頁應用，透過 HTTPS 呼叫後端 REST API 並以 STOMP over WebSocket 訂閱即時對局事件。後端為 Java Spring Boot 應用，內含使用者、房間、對局、開局、連線與歷史等服務模組，對外提供伺服器權威之 REST 命令／查詢端點與即時通道；所有落子合法性與勝負判定均在後端執行，前端僅負責呈現。資料持久化採 PostgreSQL，並以 Redis 快取線上單場遊戲狀態、排行榜及支援多實例之 Sticky Session。"));
children.push(h3("（二）圖說說明"));
children.push(caption("圖 4：系統架構圖"));
children.push(...mermaid([
  "flowchart LR", "    subgraph Client[前端 Next.js | React]", "        UI[網頁 UI]", "        WS[STOMP.js | SockJS 客戶端]", "    end",
  "    subgraph Backend[後端 Spring Boot]", "        REST[REST Controller 伺服器權威驗證]", "        STOMP[WebSocket | STOMP Broker]",
  "        SVC[Game | Room | User | Opening 服務]", "    end", "    DB[(PostgreSQL)]", "    CACHE[(Redis)]",
  "    UI -->|HTTPS REST| REST", "    WS <-->|STOMP over WebSocket| STOMP", "    REST --> SVC", "    STOMP --> SVC",
  "    SVC --> DB", "    SVC --> CACHE",
]));
children.push(p("各元件角色說明如下："));
children.push(bullet("前端網頁 UI：以 Next.js（App Router）+ React + Tailwind CSS 建構，負責棋盤渲染與互動、動畫呈現與響應式版型；落子等操作送往後端驗證後再呈現結果。"));
children.push(bullet("STOMP 客戶端：以 STOMP.js／SockJS 訂閱對局與房間即時通道，接收落子廣播、開局同步、Ready 與聊天等事件。"));
children.push(bullet("REST Controller：後端伺服器權威驗證入口，處理註冊登入、房間、對局命令與查詢。"));
children.push(bullet("WebSocket／STOMP Broker：負責即時事件之廣播與訂閱管理。"));
children.push(bullet("服務層：封裝使用者、房間、對局、開局與連線之業務邏輯，含落子驗證與勝負判定（共用 GameLogic）。"));
children.push(bullet("PostgreSQL：持久化帳號、戰績、房間、對局、落子與開局子。"));
children.push(bullet("Redis：快取線上單場遊戲狀態與排行榜，並支援多實例部署之 Sticky Session。"));
children.push(h3("（三）環境與部署"));
children.push(p("本平台規劃兩套環境：開發環境（dev）於本機以 Docker Compose 一鍵啟動後端 Spring Boot、PostgreSQL 與 Redis，供本機開發與整合測試；正式環境（prod）部署於 Render 平台，後端 Spring Boot 服務搭配 PostgreSQL 與 Redis 受管服務，前端 Next.js 一併部署於 Render。簽章密鑰、資料庫連線等敏感設定於各環境以環境變數注入，不入版本庫。"));
children.push(h2("二、技術選用"));
children.push(caption("表 3：技術選用"));
children.push(tbl([3120, 3120, 3120],
  ["項目", "版本", "用途"],
  [
    ["Java", "21", "後端開發語言"],
    ["Spring Boot", "3.2", "後端應用框架"],
    ["Spring Security", "隨 Spring Boot 3.2 BOM", "身份驗證與授權（JWT）"],
    ["Spring Data JPA", "隨 Spring Boot 3.2 BOM", "物件關聯對映與持久化"],
    ["Spring WebSocket（STOMP）", "隨 Spring Boot 3.2 BOM", "即時對局通訊"],
    ["Flyway", "10.x", "資料庫結構版控與遷移"],
    ["Cucumber", "7.15", "BDD 驗收測試"],
    ["Testcontainers", "1.19.x", "端對端整合測試容器"],
    ["PostgreSQL", "16", "主資料庫"],
    ["Redis", "7.2", "遊戲狀態／排行榜快取、Sticky Session"],
    ["Next.js", "14", "前端框架（App Router）"],
    ["React", "18", "前端 UI 函式庫"],
    ["TypeScript", "5.x", "前端開發語言"],
    ["Tailwind CSS", "3.4", "前端樣式框架"],
    ["Framer Motion", "11", "前端動畫（硬幣／落子動畫）"],
    ["MSW", "2.x", "前端 API Mock"],
    ["Playwright", "1.4x", "前端端對端測試"],
    ["@stomp/stompjs / SockJS", "7.x", "前端即時通訊客戶端"],
  ]));
children.push(h2("三、API 設計"));
children.push(h3("（一）規範說明"));
children.push(p("本平台 API 契約以 OpenAPI 3.0.0 定義，伺服器路徑為 /api/{system-code}/{api-version}，預設 system-code 為 gmk、api-version 為 v1，即 /api/gmk/v1。介接以 HTTPS 為傳輸層，請求與回應採 application/json。即時對局之落子廣播、開局同步與聊天走 STOMP over WebSocket（見本節「即時通道」），REST 端點則為伺服器權威之命令／查詢入口。"));
children.push(p("API 使用方式依權限分類：/auth/* 為免驗證之身份取得入口；其餘房間、對局、開局、戰績相關端點需附帶登入所核發之 JWT。共用回應外層為 ManageResponse（含 status／code／message），分頁查詢另含 ManagePageResponse（items／totalCount）。"));
children.push(h3("（二）錯誤代碼表"));
children.push(caption("表 4：錯誤代碼表"));
children.push(tbl([1900, 1900, 2200, 3360],
  ["HttpStatusCode", "錯誤代碼", "錯誤訊息", "說明"],
  [
    ["200", "200000", "OK", "操作成功"],
    ["400", "400001", "Bad Request", "請求參數錯誤"],
    ["401", "401001", "Unauthorized", "未登入或憑證無效"],
    ["403", "403001", "Forbidden", "權限不足（如非假先方放置開局子、觀戰者標記 Ready）"],
    ["404", "404001", "Not Found", "資源不存在"],
    ["422", "422001", "Unprocessable Entity", "業務規則不滿足（落子不合法、悔非最後一子等）"],
  ]));
children.push(note("備註：錯誤代碼依 api.yml 之 components.responses 範例值整理；上表 code 欄為 OpenAPI 契約所示之範例代碼。"));
children.push(h3("（三）API 清單"));
children.push(caption("表 5：API 清單"));
children.push(tbl([1400, 5160, 2800],
  ["方法", "路由", "名稱"],
  [
    ["POST", "/auth/register", "註冊帳號"],
    ["POST", "/auth/login", "登入取得 JWT"],
    ["POST", "/auth/guest", "訪客模式進入"],
    ["GET", "/players/{playerId}/stats", "查看個人戰績"],
    ["GET", "/leaderboard", "查看排行榜"],
    ["POST", "/rooms", "建立房間"],
    ["GET", "/rooms", "公開房間列表"],
    ["POST", "/rooms/{roomId}/actions/join", "加入房間"],
    ["POST", "/rooms/actions/quick-match", "快速配對"],
    ["POST", "/rooms/{roomId}/actions/toggle-ready", "切換 Ready 狀態"],
    ["POST", "/games", "開始本地遊戲"],
    ["POST", "/games/{gameId}/actions/coin-toss", "投擲硬幣"],
    ["POST", "/games/{gameId}/moves", "落子"],
    ["POST", "/games/{gameId}/opening-stones", "Swap2 開局放置"],
    ["POST", "/games/{gameId}/opening-stones/actions/undo-last", "悔開局最後一子"],
    ["POST", "/games/{gameId}/actions/swap2-choice", "Swap2 假後方選擇"],
    ["POST", "/games/{gameId}/actions/rematch", "再戰"],
    ["GET", "/games/{gameId}/replay", "取得對局回放"],
  ]));
children.push(h3("（四）API 規格"));

const apiSpecs = [
  ["1. registerPlayer — 註冊帳號", ["API URI：POST /auth/register", "Service name：registerPlayer",
    "Request（RegisterRequest，必填 username／email／password）：username string（例 carol）；email string（format email，例 carol@example.com）；password string，minLength 8，pattern ^(?=.*[a-z])(?=.*\\d).{8,}$（最短 8 碼，須同時含英文小寫字母與數字）。",
    "Response：201 ManageResponse + data（PlayerDetailResponse：playerId／username／email），回應 header Location 指向新玩家資源；400 BadRequest；422 UnprocessableEntity。"]],
  ["2. loginPlayer — 登入取得 JWT", ["API URI：POST /auth/login", "Service name：loginPlayer",
    "Request（LoginRequest，必填 username／password）：username string；password string。",
    "Response：200 ManageResponse + data（LoginResponse：token＝JWT、playerId）；400 BadRequest；401 Unauthorized。"]],
  ["3. enterAsGuest — 訪客模式進入", ["API URI：POST /auth/guest", "Service name：enterAsGuest",
    "Request（GuestEnterRequest，必填 nickname）：nickname string（例 路人甲）。",
    "Response：200 ManageResponse + data（GuestEnterResponse：guestId、nickname）；400 BadRequest。"]],
  ["4. getPlayerStats — 查看個人戰績", ["API URI：GET /players/{playerId}/stats", "Service name：getPlayerStats",
    "Parameters：playerId（path，必填，string）。",
    "Response：200 ManageResponse + data（PlayerStatsResponse：playerId、wins、losses、draws、winRate、recentGames[RecentGameItem：gameId／result／endedAt]）；404 NotFound。"]],
  ["5. getLeaderboard — 查看排行榜", ["API URI：GET /leaderboard", "Service name：getLeaderboard",
    "Parameters（query）：skip（integer，預設 0）、top（integer，預設 20）、order（string，預設 wins desc, winRate desc）。",
    "Response：200 ManageResponse + data（ManagePageResponse + items[LeaderboardEntryResponse：rank／playerId／username／wins／losses／winRate]）。僅含累計對局數（wins+losses）≥ 10 之玩家。"]],
  ["6. createRoom — 建立房間", ["API URI：POST /rooms", "Service name：createRoom",
    "Request（RoomCreateRequest，必填 visibility）：visibility enum[PUBLIC, PRIVATE]；isSwap2Mode boolean（預設 false）。",
    "Response：201 ManageResponse + data（RoomDetailResponse），header Location；400 BadRequest；401 Unauthorized。"]],
  ["7. listPublicRooms — 公開房間列表", ["API URI：GET /rooms", "Service name：listPublicRooms",
    "Parameters（query）：skip（integer，預設 0）、top（integer，預設 20）、order（string，預設 createdAt desc）。",
    "Response：200 ManageResponse + data（ManagePageResponse + items[RoomListResponse：roomId／roomCode／hostNickname／playerCount／spectatorCount／isSwap2Mode]）。列出 PUBLIC 且 WAITING 房間。"]],
  ["8. joinRoom — 加入房間", ["API URI：POST /rooms/{roomId}/actions/join", "Service name：joinRoom",
    "Parameters：roomId（path，必填，string）。",
    "Response：200 ManageResponse + data（RoomDetailResponse，data.joinedAsRole 標明 PLAYER／SPECTATOR）；401 Unauthorized；404 NotFound。對戰席未滿成為對戰玩家，已滿則自動成為觀戰者。"]],
  ["9. quickMatch — 快速配對", ["API URI：POST /rooms/actions/quick-match", "Service name：quickMatch",
    "Response：200 ManageResponse + data（QuickMatchResponse：matched、roomId、queuePosition）；401 Unauthorized。佇列等待逾 60 秒未配對則退出佇列並由後端計時 + WS 通知。"]],
  ["10. toggleReady — 切換 Ready 狀態", ["API URI：POST /rooms/{roomId}/actions/toggle-ready", "Service name：toggleReady",
    "Parameters：roomId（path，必填，string）。",
    "Response：200 ManageResponse + data（RoomDetailResponse）；401 Unauthorized；403 Forbidden（觀戰者）；404 NotFound。兩名對戰玩家皆 Ready 觸發開局。"]],
  ["11. startLocalGame — 開始本地遊戲", ["API URI：POST /games", "Service name：startLocalGame",
    "Request（LocalGameCreateRequest，必填 useSwap2）：useSwap2 boolean（預設 false）；blackNickname string；whiteNickname string。",
    "Response：201 ManageResponse + data（GameDetailResponse：gameId／gameMode／useSwap2／status／currentTurn），header Location；400 BadRequest。"]],
  ["12. tossCoin — 投擲硬幣", ["API URI：POST /games/{gameId}/actions/coin-toss", "Service name：tossCoin",
    "Parameters：gameId（path，必填，string）。",
    "Response：200 ManageResponse + data（CoinTossResponse：gameId／coinResult[HEADS|TAILS]／tentativeFirstPlayerId／blackPlayerId／whitePlayerId）；404 NotFound。普通模式定黑白、Swap2 定假先方。"]],
  ["13. placeMove — 落子", ["API URI：POST /games/{gameId}/moves", "Service name：placeMove",
    "Parameters：gameId（path，必填，string）。",
    "Request（MoveCreateRequest，必填 row／col）：row integer（0..14）；col integer（0..14）。",
    "Response：201 ManageResponse + data（GameStateResponse：gameId／status／currentTurn／moveCount／lastMove／result／winningLine）；401 Unauthorized；404 NotFound；422 落子不合法（非當前回合／位置已佔／超出棋盤）。線上模式驗證後經 STOMP 廣播。"]],
  ["14. placeOpeningStone — Swap2 開局放置", ["API URI：POST /games/{gameId}/opening-stones", "Service name：placeOpeningStone",
    "Parameters：gameId（path，必填，string）。",
    "Request（OpeningStoneCreateRequest，必填 row／col／color）：row integer（0..14）；col integer（0..14）；color enum[BLACK, WHITE]。",
    "Response：201 ManageResponse + data（GameStateResponse）；403 Forbidden；404 NotFound；422 UnprocessableEntity。僅假先方可操作。"]],
  ["15. undoLastOpeningStone — 悔開局最後一子", ["API URI：POST /games/{gameId}/opening-stones/actions/undo-last", "Service name：undoLastOpeningStone",
    "Parameters：gameId（path，必填，string）。",
    "Response：200 ManageResponse + data（GameStateResponse）；403 Forbidden；422 UnprocessableEntity。僅允許移除最後放置的開局子。"]],
  ["16. makeSwap2Choice — Swap2 假後方選擇", ["API URI：POST /games/{gameId}/actions/swap2-choice", "Service name：makeSwap2Choice",
    "Parameters：gameId（path，必填，string）。",
    "Request（Swap2ChoiceRequest，必填 choice）：choice enum[TAKE_BLACK, TAKE_WHITE, PLACE_TWO_MORE]。",
    "Response：200 ManageResponse + data（GameStateResponse）；403 Forbidden；422 UnprocessableEntity。假後方三選一，定案最終黑白與輪次。"]],
  ["17. rematchGame — 再戰", ["API URI：POST /games/{gameId}/actions/rematch", "Service name：rematchGame",
    "Parameters：gameId（path，必填，string）。",
    "Response：201 ManageResponse + data（GameDetailResponse）；404 NotFound。本地重置（保留名稱）或線上重新開局。"]],
  ["18. getGameReplay — 取得對局回放", ["API URI：GET /games/{gameId}/replay", "Service name：getGameReplay",
    "Parameters：gameId（path，必填，string）。",
    "Response：200 ManageResponse + data（GameReplayResponse：gameId／result／winnerPlayerId／moveCount／useSwap2／openingStones[]／moves[]）；404 NotFound。回傳完整落子序列（含 openingStones）供重播。"]],
];
apiSpecs.forEach(([title, lines]) => {
  children.push(h5(title));
  lines.forEach((ln) => children.push(bullet(ln)));
});
children.push(h5("即時通道（STOMP over WebSocket）"));
children.push(p("下列即時通道非屬 OpenAPI REST paths，列此供前後端對齊："));
children.push(tbl([4680, 4680],
  ["Destination", "用途"],
  [
    ["/topic/room/{roomId}", "房間內 Ready 狀態與聊天廣播"],
    ["/topic/game/{gameId}", "對局狀態更新廣播（GameStateUpdated）"],
    ["/topic/game/{gameId}/opening", "Swap2 開局即時同步與權限控制"],
    ["/app/game/{gameId}/move", "玩家送出落子（後端驗證後廣播）"],
  ]));

children.push(h2("四、資料表結構"));
children.push(h3("（一）資料表關聯圖"));
children.push(caption("圖 5：資料表關聯圖"));
children.push(...mermaid([
  "erDiagram", "    players ||--o| player_stats : has", "    players ||--o{ game_rooms : hosts",
  "    players ||--o{ room_members : joins", "    players ||--o{ room_chat_messages : sends",
  "    game_rooms ||--o{ room_members : contains", "    game_rooms ||--o{ room_chat_messages : has",
  "    game_rooms ||--o{ games : hosts", "    games ||--o{ moves : records", "    games ||--o{ opening_stones : records",
  "    players ||--o{ games : plays", "    players ||--o{ opening_stones : places",
]));
children.push(h3("（二）資料表清單"));
children.push(caption("表 6：資料表清單"));
children.push(tbl([3120, 6240],
  ["資料表名稱", "說明"],
  [
    ["players", "玩家（註冊／訪客）基本資料"],
    ["player_stats", "玩家戰績與排行榜資料"],
    ["game_rooms", "線上對戰房間"],
    ["room_members", "房間成員及其角色與 Ready 狀態"],
    ["room_chat_messages", "房內聊天訊息"],
    ["games", "對局（本地／線上，含 Swap2 開局狀態）"],
    ["moves", "落子序列（不可變事件流）"],
    ["opening_stones", "Swap2 開局子（不可變事件流，可悔最後一子）"],
  ]));
children.push(h3("（三）資料表說明"));

function fieldTable(rows) {
  return tbl([720, 2200, 1900, 1000, 1000, 2540],
    ["", "column", "type", "nullable", "default", "comment"], rows);
}
children.push(h5("1. players 玩家"));
children.push(note("備註：訪客玩家以臨時實體表示，是否落庫由 backend 決定；email／password 對訪客為 null。"));
children.push(fieldTable([
  ["PK", "id", "varchar(36)", "N", "", "主鍵"],
  ["", "player_type", "player_type", "N", "", "REGISTERED／GUEST"],
  ["", "username", "varchar(50)", "Y", "", "註冊登入帳號／顯示暱稱；訪客為暱稱（唯一索引 uk_players_username）"],
  ["", "email", "varchar(255)", "Y", "", "訪客為 null（唯一索引 uk_players_email）"],
  ["", "password_hash", "varchar(255)", "Y", "", "訪客為 null，不存明文"],
  ["", "nickname", "varchar(50)", "Y", "", "訪客暱稱"],
  ["", "created_at", "timestamp", "N", "", "建立時間"],
  ["", "updated_at", "timestamp", "N", "", "更新時間"],
  ["", "version", "int", "N", "0", "樂觀鎖版本"],
  ["", "is_deleted", "boolean", "N", "false", "軟刪除標記"],
]));
children.push(h5("2. player_stats 玩家戰績"));
children.push(note("備註：排行榜主鍵 wins DESC、次鍵 win_rate DESC；上榜門檻 wins+losses ≥ 10（索引 idx_player_stats_leaderboard）。"));
children.push(fieldTable([
  ["PK", "id", "varchar(36)", "N", "", "主鍵"],
  ["FK", "player_id", "varchar(36)", "N", "", "對應 players.id（唯一索引 uk_player_stats_player_id）"],
  ["", "wins", "int", "N", "0", "勝場"],
  ["", "losses", "int", "N", "0", "敗場"],
  ["", "draws", "int", "N", "0", "和局數（雙方同時斷線判和等）"],
  ["", "win_rate", "decimal(19,4)", "N", "0", "勝率，由 wins/(wins+losses) 推導快取"],
  ["", "created_at", "timestamp", "N", "", "建立時間"],
  ["", "updated_at", "timestamp", "N", "", "更新時間"],
  ["", "version", "int", "N", "0", "樂觀鎖版本"],
  ["", "is_deleted", "boolean", "N", "false", "軟刪除標記"],
]));
children.push(h5("3. game_rooms 對戰房間"));
children.push(fieldTable([
  ["PK", "id", "varchar(36)", "N", "", "主鍵"],
  ["", "room_code", "varchar(12)", "N", "", "房間碼（唯一索引 uk_game_rooms_room_code）"],
  ["", "visibility", "room_visibility", "N", "", "PUBLIC／PRIVATE"],
  ["", "status", "room_status", "N", "WAITING", "WAITING／READY／IN_PROGRESS／FINISHED"],
  ["", "is_swap2_mode", "boolean", "N", "false", "是否 Swap2 模式"],
  ["FK", "host_player_id", "varchar(36)", "N", "", "房主，對應 players.id"],
  ["FK", "guest_player_id", "varchar(36)", "Y", "", "第二位對戰玩家，未加入前為 null（對戰席上限 2）"],
  ["", "created_at", "timestamp", "N", "", "建立時間"],
  ["", "updated_at", "timestamp", "N", "", "更新時間"],
  ["", "version", "int", "N", "0", "樂觀鎖版本"],
  ["", "is_deleted", "boolean", "N", "false", "軟刪除標記"],
]));
children.push(note("備註：索引 idx_game_rooms_visibility_status 用於公開房間列表查詢（visibility, status）。"));
children.push(h5("4. room_members 房間成員"));
children.push(note("備註：對戰席（role=PLAYER）每房至多 2 筆；其餘為 SPECTATOR 觀戰席（唯讀，is_ready 恆 false）。索引 idx_room_members_room_role 依房間統計席位數。"));
children.push(fieldTable([
  ["PK", "id", "varchar(36)", "N", "", "主鍵"],
  ["FK", "room_id", "varchar(36)", "N", "", "對應 game_rooms.id"],
  ["FK", "player_id", "varchar(36)", "N", "", "對應 players.id（複合唯一索引 uk_room_members_room_player）"],
  ["", "role", "room_member_role", "N", "PLAYER", "PLAYER 對戰席（上限 2）／SPECTATOR 觀戰席"],
  ["", "is_ready", "boolean", "N", "false", "觀戰席恆 false，不參與 Ready 判定"],
  ["", "created_at", "timestamp", "N", "", "建立時間"],
  ["", "updated_at", "timestamp", "N", "", "更新時間"],
  ["", "version", "int", "N", "0", "樂觀鎖版本"],
  ["", "is_deleted", "boolean", "N", "false", "軟刪除標記"],
]));
children.push(h5("5. room_chat_messages 房內聊天訊息"));
children.push(fieldTable([
  ["PK", "id", "varchar(36)", "N", "", "主鍵"],
  ["FK", "room_id", "varchar(36)", "N", "", "對應 game_rooms.id（索引 idx_room_chat_messages_room_id）"],
  ["FK", "player_id", "varchar(36)", "N", "", "對應 players.id"],
  ["", "content", "varchar(500)", "N", "", "訊息內容（上限 500 字）"],
  ["", "created_at", "timestamp", "N", "", "建立時間"],
  ["", "updated_at", "timestamp", "N", "", "更新時間"],
  ["", "version", "int", "N", "0", "樂觀鎖版本"],
  ["", "is_deleted", "boolean", "N", "false", "軟刪除標記"],
]));
children.push(h5("6. games 對局"));
children.push(fieldTable([
  ["PK", "id", "varchar(36)", "N", "", "主鍵"],
  ["FK", "room_id", "varchar(36)", "Y", "", "本地對局可為 null（對應 game_rooms.id，索引 idx_games_room_id）"],
  ["", "game_mode", "game_mode", "N", "", "LOCAL／ONLINE"],
  ["", "opening_type", "opening_type", "N", "STANDARD", "STANDARD／SWAP2"],
  ["", "use_swap2", "boolean", "N", "false", "是否啟用 Swap2"],
  ["", "status", "game_status", "N", "PLAYING", "OPENING／PLAYING／FINISHED"],
  ["FK", "black_player_id", "varchar(36)", "Y", "", "黑方，Swap2 開局期間可為 null"],
  ["FK", "white_player_id", "varchar(36)", "Y", "", "白方"],
  ["FK", "tentative_first_player_id", "varchar(36)", "Y", "", "Swap2 假先方"],
  ["", "coin_result", "coin_result", "Y", "", "硬幣結果 HEADS／TAILS（後端決定）"],
  ["", "current_turn", "stone_color", "Y", "", "當前輪到的顏色 BLACK／WHITE"],
  ["", "result", "game_result", "Y", "", "結束時填入 BLACK_WIN／WHITE_WIN／DRAW"],
  ["FK", "winner_player_id", "varchar(36)", "Y", "", "勝者，和局為 null（索引 idx_games_winner_player_id）"],
  ["", "move_count", "int", "N", "0", "落子數"],
  ["", "duration_seconds", "int", "Y", "", "對局耗時（秒）"],
  ["", "ended_at", "timestamp", "Y", "", "結束時間"],
  ["", "created_at", "timestamp", "N", "", "建立時間"],
  ["", "updated_at", "timestamp", "N", "", "更新時間"],
  ["", "version", "int", "N", "0", "樂觀鎖版本"],
  ["", "is_deleted", "boolean", "N", "false", "軟刪除標記"],
]));
children.push(h5("7. moves 落子序列"));
children.push(note("備註：不可變對局事件流，免審計欄位（created_at／updated_at／version／is_deleted exempt）。"));
children.push(fieldTable([
  ["PK", "id", "varchar(36)", "N", "", "主鍵"],
  ["FK", "game_id", "varchar(36)", "N", "", "對應 games.id"],
  ["", "move_number", "int", "N", "", "落子序號，從 1 起（複合唯一索引 uk_moves_game_move_number）"],
  ["", "color", "stone_color", "N", "", "BLACK／WHITE"],
  ["", "row", "int", "N", "", "列，0..14"],
  ["", "col", "int", "N", "", "行，0..14（複合唯一索引 uk_moves_game_position）"],
  ["", "placed_at", "timestamp", "N", "", "落子時間"],
]));
children.push(h5("8. opening_stones Swap2 開局子"));
children.push(note("備註：開局事件流，可被「悔最後一子」物理移除（updated_at／version exempt）。"));
children.push(fieldTable([
  ["PK", "id", "varchar(36)", "N", "", "主鍵"],
  ["FK", "game_id", "varchar(36)", "N", "", "對應 games.id"],
  ["", "sequence", "int", "N", "", "開局放置順序，從 1 起（複合唯一索引 uk_opening_stones_game_sequence）"],
  ["", "color", "stone_color", "N", "", "BLACK／WHITE"],
  ["", "row", "int", "N", "", "列"],
  ["", "col", "int", "N", "", "行"],
  ["FK", "placed_by_player_id", "varchar(36)", "N", "", "放置者，對應 players.id"],
  ["", "placed_at", "timestamp", "N", "", "放置時間"],
]));

// ===== 陸、測試與驗收 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun("陸、測試與驗收")] }));
children.push(p("本平台之驗收以 Gherkin 驗收規格（specs/features/**/*.feature）為基準，採後端伺服器權威驗證之端對端（E2E）策略，驗收重點如下："));
children.push(bullet("使用者管理：註冊欄位驗證（username／email 唯一、email 格式、密碼規則）、登入核發 JWT、訪客非空暱稱與單場限制、戰績計算與排行榜排序（主鍵 wins、次鍵 winRate、門檻 10 場）。"));
children.push(bullet("對局正確性：15×15 棋盤落子合法性（在盤內、空位、輪次）、五連與長連判勝、無禁手、棋盤填滿判和；本地與線上落子規則一致。"));
children.push(bullet("Swap2 開局：黑·白·黑放置順序與權限（僅假先方）、悔最後一子限制、假後方三選一之顏色與輪次定案。"));
children.push(bullet("房間與配對：房間碼唯一、對戰席上限 2 與觀戰者轉換、Ready 觸發開局（僅統計 PLAYER）、快速配對與 60 秒逾時。"));
children.push(bullet("連線一致性：心跳偵測、斷線寬限、逾時判負、雙方斷線判和、對局未開始斷線不判負。"));
children.push(bullet("資料一致性與回放：對局結束保存完整落子序列（含開局子），回放依序可重播。"));
children.push(bullet("安全性：權限路徑分類（免驗證／需 JWT）、403／401 錯誤處理、密碼雜湊儲存。"));
children.push(p("本章僅摘錄驗收重點，完整測試計畫暨報告請參閱柒、附錄引用所列之整合測試產出文件。完整測試計畫暨報告文件之正式檔名為 integration-test/REPORT.md，作為本文件之交付附件；其驗收結果為 Cucumber 後端 BDD 64／64 全數通過、Playwright 真實 API 端對端 7／7 全數通過、MSW 前端回歸 5／5 全數通過。"));

// ===== 柒、附錄引用 =====
children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun("柒、附錄引用")] }));
children.push(h2("一、本專案規格文件（內部）"));
[
  "需求活動圖：specs/activities/使用者管理.mmd、本地雙人對戰.mmd、線上連線對戰.mmd",
  "驗收規格（Gherkin）：specs/features/ 下 connection／game／history／opening／room／user 共 17 份 .feature",
  "API 契約：specs/api.yml（OpenAPI 3.0.0）",
  "資料模型：specs/erm.dbml（DBML，PostgreSQL）",
  "角色定義：specs/actors/訪客玩家.md、specs/actors/註冊玩家.md",
  "介面定義：specs/ui/ 下 11 份頁面定義",
  "系統抽象（BDD Analysis Phase 03）：specs/features/系統抽象.md",
  "技術棧定義：specs/infrastructure.yml、specs/arguments.yml",
].forEach((t) => children.push(num("appx1", t)));
children.push(h2("二、整合測試產出文件（外部引用）"));
children.push(num("appx2", "整合測試計畫暨報告：integration-test/REPORT.md（2026/06/07，Quality Gate PASS：Cucumber 64／64＋Playwright 真實 API 7／7＋MSW 回歸 5／5）"));

// ===== Document =====
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { size: 52, bold: true, font: FONT },
        paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: "1F3864", font: FONT }, paragraph: { spacing: { before: 280, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: "2E5496", font: FONT }, paragraph: { spacing: { before: 200, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: "000000", font: FONT }, paragraph: { spacing: { before: 160, after: 120 }, outlineLevel: 2 } },
      { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, color: "000000", font: FONT }, paragraph: { spacing: { before: 140, after: 100 }, outlineLevel: 3 } },
      { id: "Heading5", name: "Heading 5", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "333333", font: FONT }, paragraph: { spacing: { before: 120, after: 80 }, outlineLevel: 4 } },
    ],
  },
  numbering: {
    config: [
      { reference: "blist", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 300 } } } }] },
      { reference: "flow1", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "(%1)", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 360 } } } }] },
      { reference: "flow2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "(%1)", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 360 } } } }] },
      { reference: "flow3", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "(%1)", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 360 } } } }] },
      { reference: "appx1", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 360 } } } }] },
      { reference: "appx2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun("第 "), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun(" 頁，共 "), new TextRun({ children: [PageNumber.TOTAL_PAGES] }), new TextRun(" 頁")] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("WROTE " + OUT + " (" + buf.length + " bytes)"); });
