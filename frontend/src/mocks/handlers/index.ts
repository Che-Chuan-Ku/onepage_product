import { http, HttpResponse } from "msw";
import { API_BASE } from "@/lib/api/config";
import {
  RegisterRequest,
  LoginRequest,
  GuestEnterRequest,
  RoomCreateRequest,
  SelectClassRequest,
  LocalGameCreateRequest,
  MoveCreateRequest,
  OpeningStoneCreateRequest,
  Swap2ChoiceRequest,
  type ClassType,
  type Color,
  type FieldType,
  type GameStatus,
  type GameResult,
  type RoomStatus,
  type RoomVisibility,
} from "@/lib/types/schemas";
import { checkWin, key, type Board } from "@/lib/game/winCheck";
import {
  applyDuelMove,
  createDuelGame,
  duelGames,
  duelGameDetail,
  duelGameReplay,
  duelGameState,
  ensureDemoDuelGames,
} from "./duelEngine";
import {
  leaderboard,
  myStats,
  publicRooms,
  makeRoomDetail,
  replayGame,
  duelReplayGame,
} from "../data/fixtures";
import {
  PveRunCreateRequest,
  PveMoveCreateRequest,
  PveSkillUseRequest,
  PveShopPurchaseRequest,
} from "@/lib/types/schemas";
import { PVE_ERROR } from "../data/pveFixtures";
import {
  createPveRun,
  getCurrentPveRun,
  abandonPveRun,
  getPveRunResult,
  getPveEncounter,
  placePveMove,
  usePveSkill,
  retryPveEncounter,
  getPveShop,
  purchasePveShopOffer,
  rerollPveShop,
  skipPveShop,
} from "./pveEngine";

/** Standard success envelope (ManageResponse + data). */
const ok = (data: unknown, code = "200000", message = "OK") =>
  HttpResponse.json({ status: "success", code, message, data });
const created = (data: unknown, message = "Created") =>
  HttpResponse.json({ status: "success", code: "201000", message, data }, { status: 201 });
const fail = (
  httpStatus: number,
  code: string,
  message: string,
  data: unknown = {},
) =>
  HttpResponse.json({ status: "error", code, message, data }, { status: httpStatus });

// ── in-memory game state (server-authoritative simulation) ─────
interface GameState {
  gameId: string;
  gameMode: "LOCAL" | "ONLINE";
  useSwap2: boolean;
  status: GameStatus;
  currentTurn: Color | null;
  board: Board;
  moveCount: number;
  openingStones: { row: number; col: number; color: Color }[];
  /** Swap2 二階段（PLACE_TWO_MORE）已選定：允許再放 2 子（共 5），下一次
   * swap2-choice 只能二選一（執黑/執白）finalize（regression fix）。 */
  swap2TwoMoreChosen: boolean;
  /** ordered move log so GET /replay can rebuild THIS game (not a fixture) */
  moves: { moveNumber: number; color: Color; row: number; col: number }[];
  lastMove: { color: Color; row: number; col: number } | null;
  result: GameResult | null;
  winningLine: { row: number; col: number }[] | null;
}
const games = new Map<string, GameState>();
let gameSeq = 0;

function newGame(useSwap2: boolean, mode: "LOCAL" | "ONLINE"): GameState {
  const gameId = `game-${++gameSeq}`;
  const g: GameState = {
    gameId,
    gameMode: mode,
    useSwap2,
    status: useSwap2 ? "OPENING" : "PLAYING",
    currentTurn: useSwap2 ? null : "BLACK",
    board: {},
    moveCount: 0,
    openingStones: [],
    swap2TwoMoreChosen: false,
    moves: [],
    lastMove: null,
    result: null,
    winningLine: null,
  };
  games.set(gameId, g);
  return g;
}

/** Truthful replay for a mock-created game（fresh games must NOT inherit the
 *  demo fixture — the game page rebuilds its board from this response）. */
function gameReplay(g: GameState) {
  return {
    gameId: g.gameId,
    result: g.result,
    winnerPlayerId: null,
    moveCount: g.moveCount,
    useSwap2: g.useSwap2,
    openingStones: g.openingStones.map((s, i) => ({
      sequence: i + 1,
      color: s.color,
      row: s.row,
      col: s.col,
    })),
    moves: g.moves,
  };
}

function gameState(g: GameState) {
  return {
    gameId: g.gameId,
    status: g.status,
    currentTurn: g.currentTurn,
    moveCount: g.moveCount,
    lastMove: g.lastMove,
    result: g.result,
    winningLine: g.winningLine,
  };
}
function gameDetail(g: GameState) {
  return {
    gameId: g.gameId,
    gameMode: g.gameMode,
    useSwap2: g.useSwap2,
    status: g.status,
    currentTurn: g.currentTurn,
  };
}

// ── in-memory room state (serious-duel class selection flow) ───
interface MockRoom {
  roomId: string;
  roomCode: string;
  visibility: RoomVisibility;
  isSwap2Mode: boolean;
  battleMode: "NORMAL" | "SERIOUS_DUEL";
  fieldType: FieldType | null;
  status: RoomStatus;
  hostClass: ClassType | null;
  hostReady: boolean;
  /** the fake opponent's (阿哲) pick — hidden until game start (Q8) */
  opponentClass: ClassType;
  gameId?: string;
}
const mockRooms = new Map<string, MockRoom>();

function mockRoomDetail(room: MockRoom) {
  const duel = room.battleMode === "SERIOUS_DUEL";
  // Opponent classType stays null for the requester (single mock user =
  // host, a battle player) until ClassesRevealed at game start (Q8).
  const revealOpponent = duel && room.status === "IN_PROGRESS";
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    visibility: room.visibility,
    status: room.status,
    isSwap2Mode: room.isSwap2Mode,
    battleMode: room.battleMode,
    fieldType: room.fieldType,
    hostPlayerId: "p-001",
    joinedAsRole: "PLAYER" as const,
    spectatorCount: 0,
    members: [
      {
        playerId: "p-001",
        nickname: "KuPlayer",
        role: "PLAYER" as const,
        isReady: room.hostReady,
        classType: duel ? room.hostClass : null,
      },
      // fake opponent member (existing mock convention: 阿哲 / p-zhe)
      ...(duel
        ? [
            {
              playerId: "p-zhe",
              nickname: "阿哲",
              role: "PLAYER" as const,
              isReady: true,
              classType: revealOpponent ? room.opponentClass : null,
            },
          ]
        : []),
    ],
  };
}

const p = (path: string) => `${API_BASE}${path}`;

/** PVE endpoints all declare a 401 response; the mock treats a missing
 * Authorization header as "not logged in" (guest tokens aren't set by the
 * /auth/guest mock handler above, so guests naturally hit this branch). */
function requirePveAuth(request: Request, message: string = PVE_ERROR.UNAUTHORIZED) {
  if (!request.headers.get("Authorization")) return fail(401, "401001", message);
  return null;
}

export const handlers = [
  // ── auth ───────────────────────────────────────────────────
  http.post(p("/auth/register"), async ({ request }) => {
    const body = RegisterRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422001", "註冊資料不合法");
    if (body.data.username.toLowerCase() === "admin")
      return fail(422, "422002", "此帳號或 Email 已被使用");
    return created(
      { playerId: "p-new", username: body.data.username, email: body.data.email },
      "註冊成功",
    );
  }),

  http.post(p("/auth/login"), async ({ request }) => {
    const body = LoginRequest.safeParse(await request.json());
    if (!body.success) return fail(400, "400001", "帳號或密碼錯誤");
    return ok({ token: "mock-jwt-token", playerId: "p-001" }, "200000", "登入成功");
  }),

  http.post(p("/auth/guest"), async ({ request }) => {
    const body = GuestEnterRequest.safeParse(await request.json());
    if (!body.success || !body.data.nickname.trim())
      return fail(400, "400001", "請先輸入暱稱");
    return ok(
      { guestId: `g-${Date.now().toString(36)}`, nickname: body.data.nickname },
      "200000",
      "以訪客身份進入",
    );
  }),

  // ── players / leaderboard ──────────────────────────────────
  http.get(p("/players/:playerId/stats"), () => ok(myStats)),
  http.get(p("/leaderboard"), () =>
    ok({ items: leaderboard, totalCount: leaderboard.length }),
  ),

  // ── rooms ──────────────────────────────────────────────────
  http.post(p("/rooms"), async ({ request }) => {
    const body = RoomCreateRequest.safeParse(await request.json());
    if (!body.success) return fail(400, "400001", "房間資料不合法");
    // 真劍勝負參數衝突（api.yml:211-215, code 422002）
    if (body.data.battleMode === "SERIOUS_DUEL") {
      if (body.data.isSwap2Mode)
        return fail(422, "422002", "真劍勝負模式與 Swap2 開局互斥");
      if (!body.data.fieldType)
        return fail(422, "422002", "真劍勝負模式必須指定場地（fieldType）");
    } else if (body.data.fieldType) {
      return fail(422, "422002", "fieldType 僅限真劍勝負模式指定");
    }
    const roomId = `r-${Date.now().toString(36)}`;
    const room: MockRoom = {
      roomId,
      roomCode: Math.random().toString(36).slice(2, 6).toUpperCase(),
      visibility: body.data.visibility,
      isSwap2Mode: body.data.isSwap2Mode,
      battleMode: body.data.battleMode,
      fieldType: body.data.fieldType ?? null,
      status: "WAITING",
      hostClass: null,
      hostReady: false,
      opponentClass: "ARCHER",
    };
    mockRooms.set(roomId, room);
    if (room.battleMode === "SERIOUS_DUEL")
      return created(mockRoomDetail(room), "房間已建立");
    // NORMAL rooms: keep the pre-duel response shape verbatim
    return created(
      makeRoomDetail(roomId, {
        roomCode: room.roomCode,
        visibility: body.data.visibility,
        isSwap2Mode: body.data.isSwap2Mode,
        spectatorCount: 0,
        members: [
          { playerId: "p-001", nickname: "KuPlayer", role: "PLAYER", isReady: false },
        ],
      }),
      "房間已建立",
    );
  }),
  // Room snapshot — duel rooms come from the in-memory store; known public
  // fixtures fall back to makeRoomDetail; anything else 404s (the room page
  // tolerates failure, matching the previously-unhandled behavior).
  http.get(p("/rooms/:roomId"), ({ params }) => {
    const roomId = String(params.roomId);
    const room = mockRooms.get(roomId);
    if (room) return ok(mockRoomDetail(room));
    if (publicRooms.some((r) => r.roomId === roomId)) return ok(makeRoomDetail(roomId));
    return fail(404, "404001", "房間不存在");
  }),
  // 真劍勝負職業選擇（operationId selectClass, api.yml:310-352）
  http.post(p("/rooms/:roomId/actions/select-class"), async ({ params, request }) => {
    const room = mockRooms.get(String(params.roomId));
    if (!room) return fail(404, "404001", "房間不存在");
    if (room.battleMode !== "SERIOUS_DUEL")
      return fail(422, "422001", "非真劍勝負房間");
    if (room.hostReady || room.status !== "WAITING")
      return fail(422, "422002", "Ready 後職業已鎖定");
    const body = SelectClassRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422001", "職業選擇不合法");
    room.hostClass = body.data.classType;
    return ok(mockRoomDetail(room), "200000", "職業已選擇");
  }),
  http.get(p("/rooms"), () =>
    ok({ items: publicRooms, totalCount: publicRooms.length }),
  ),
  http.post(p("/rooms/:roomId/actions/join"), ({ params }) => {
    const roomId = String(params.roomId);
    const base = publicRooms.find((r) => r.roomId === roomId);
    if (!base && !roomId.startsWith("r-"))
      return fail(404, "404001", "房間不存在，請確認房間碼");
    // 對戰席滿 -> 觀戰者 (Q5)
    const asSpectator = (base?.playerCount ?? 0) >= 2;
    return ok(
      makeRoomDetail(roomId, {
        joinedAsRole: asSpectator ? "SPECTATOR" : "PLAYER",
        spectatorCount: (base?.spectatorCount ?? 2) + (asSpectator ? 1 : 0),
      }),
      "200000",
      asSpectator ? "對戰席已滿，已以觀戰者身份進入" : "加入成功",
    );
  }),
  http.post(p("/rooms/actions/quick-match"), () =>
    // demo: immediate match
    ok({ matched: true, roomId: "r-quick", queuePosition: null }, "200000", "配對成功"),
  ),
  http.post(p("/rooms/:roomId/actions/toggle-ready"), ({ params }) => {
    const roomId = String(params.roomId);
    const room = mockRooms.get(roomId);
    if (room && room.battleMode === "SERIOUS_DUEL") {
      // Ready locks the class pick (Q8); un-ready re-opens it.
      room.hostReady = !room.hostReady;
      if (room.status === "WAITING" || room.status === "READY")
        room.status = room.hostReady ? "READY" : "WAITING";
      return ok(mockRoomDetail(room), "200000", "切換成功");
    }
    // NORMAL rooms: pre-duel behavior verbatim
    return ok(
      makeRoomDetail(roomId, {
        status: "READY",
        members: [
          { playerId: "p-zhe", nickname: "阿哲", role: "PLAYER", isReady: true },
          { playerId: "p-001", nickname: "KuPlayer", role: "PLAYER", isReady: true },
        ],
      }),
      "200000",
      "切換成功",
    );
  }),
  // Start the duel game from a READY duel room (idempotent). NORMAL rooms
  // keep 404ing here — same failure path as when this route was unhandled.
  http.post(p("/rooms/:roomId/actions/start-game"), ({ params }) => {
    const room = mockRooms.get(String(params.roomId));
    if (!room || room.battleMode !== "SERIOUS_DUEL" || !room.fieldType)
      return fail(404, "404001", "房間不存在或非真劍勝負房間");
    if (!room.gameId) {
      room.gameId = `duel-${room.roomId}`;
      // deterministic seed per room so reloads keep the same hidden cells
      let seed = 7;
      for (const ch of room.roomId) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
      createDuelGame({
        gameId: room.gameId,
        fieldType: room.fieldType,
        blackClass: room.hostClass ?? "WARRIOR",
        whiteClass: room.opponentClass,
        gameMode: "ONLINE",
        seed,
      });
      room.status = "IN_PROGRESS";
    }
    return ok(
      {
        event: "GameStarted",
        gameId: room.gameId,
        useSwap2: false,
        status: "PLAYING",
        tentativeFirstPlayerId: null,
        blackPlayerId: "p-001",
        whitePlayerId: "p-zhe",
      },
      "200000",
      "對局開始",
    );
  }),

  // ── games ──────────────────────────────────────────────────
  http.post(p("/games"), async ({ request }) => {
    const body = LocalGameCreateRequest.safeParse(await request.json());
    if (!body.success) return fail(400, "400001", "資料不合法");
    return created(gameDetail(newGame(body.data.useSwap2, "LOCAL")), "本地對局已建立");
  }),

  http.post(p("/games/:gameId/actions/coin-toss"), ({ params }) => {
    const g = games.get(String(params.gameId));
    if (!g) return fail(404, "404001", "對局不存在");
    const heads = Math.random() < 0.5;
    // Swap2: tentative first player; normal: assign black/white
    return ok({
      gameId: g.gameId,
      coinResult: heads ? "HEADS" : "TAILS",
      tentativeFirstPlayerId: g.useSwap2 ? "p-001" : null,
      blackPlayerId: g.useSwap2 ? null : "p-001",
      whitePlayerId: g.useSwap2 ? null : "p-zhe",
    });
  }),

  http.post(p("/games/:gameId/moves"), async ({ params, request }) => {
    ensureDemoDuelGames();
    const gameId = String(params.gameId);
    // ── serious-duel games: dispatch to the duel engine ──
    const dg = duelGames.get(gameId);
    if (dg) {
      const body = MoveCreateRequest.safeParse(await request.json());
      if (!body.success) return fail(422, "422001", "落子資料不合法");
      const res = applyDuelMove(dg, body.data);
      if (!res.ok) return fail(res.httpStatus, res.code, res.message);
      return created(duelGameState(res.game), "落子成功");
    }
    // ── normal games: pre-duel behavior (15x15, no skills) ──
    const g = games.get(gameId);
    if (!g) return fail(404, "404001", "對局不存在");
    const body = MoveCreateRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422001", "落子位置超出棋盤");
    if (!("row" in body.data) || body.data.skill)
      return fail(422, "422001", "非真劍勝負對局不支援技能");
    const { row, col } = body.data;
    // schema upper bound is now the two-field union (15); normal games stay
    // strictly 0..14, so re-reject 15 with the pre-duel message.
    if (row > 14 || col > 14) return fail(422, "422001", "落子位置超出棋盤");
    if (g.status !== "PLAYING" || g.currentTurn == null)
      return fail(422, "422003", "目前無法落子");
    if (g.board[key(row, col)]) return fail(422, "422002", "該位置已有棋子");

    const color = g.currentTurn;
    g.board[key(row, col)] = color;
    g.moveCount += 1;
    g.moves.push({ moveNumber: g.moveCount, color, row, col });
    g.lastMove = { color, row, col };

    const line = checkWin(g.board, row, col, color);
    if (line) {
      g.status = "FINISHED";
      g.result = color === "BLACK" ? "BLACK_WIN" : "WHITE_WIN";
      g.winningLine = line;
      g.currentTurn = null;
    } else if (g.moveCount >= 15 * 15) {
      g.status = "FINISHED";
      g.result = "DRAW";
      g.currentTurn = null;
    } else {
      g.currentTurn = color === "BLACK" ? "WHITE" : "BLACK";
    }
    return created(gameState(g), "落子成功");
  }),

  http.post(p("/games/:gameId/opening-stones"), async ({ params, request }) => {
    const g = games.get(String(params.gameId));
    if (!g) return fail(404, "404001", "對局不存在");
    if (!g.useSwap2 || g.status !== "OPENING")
      return fail(422, "422001", "非開局階段");
    const body = OpeningStoneCreateRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422001", "開局子資料不合法");
    // regression fix: after PLACE_TWO_MORE the cap is 5, not 3 (放第四、五子二階段).
    const cap = g.swap2TwoMoreChosen ? 5 : 3;
    if (g.openingStones.length >= cap) return fail(422, "422002", `開局子已滿 ${cap} 顆`);
    const { row, col, color } = body.data;
    if (g.board[key(row, col)]) return fail(422, "422003", "該位置已有棋子");
    g.board[key(row, col)] = color;
    g.openingStones.push({ row, col, color });
    g.lastMove = { color, row, col };
    return created(gameState(g), "開局子已放置");
  }),

  http.post(p("/games/:gameId/opening-stones/actions/undo-last"), ({ params }) => {
    const g = games.get(String(params.gameId));
    if (!g) return fail(404, "404001", "對局不存在");
    const last = g.openingStones.pop();
    if (!last) return fail(422, "422001", "沒有可悔的開局子");
    delete g.board[key(last.row, last.col)];
    g.lastMove = null;
    return ok(gameState(g), "200000", "已悔最後一子");
  }),

  http.post(p("/games/:gameId/actions/swap2-choice"), async ({ params, request }) => {
    const g = games.get(String(params.gameId));
    if (!g) return fail(404, "404001", "對局不存在");
    const body = Swap2ChoiceRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422001", "選擇不合法");
    // regression fix: PLACE_TWO_MORE must stay in OPENING for the 4th/5th
    // stone stage (not finalize into PLAYING) — it was unconditionally
    // finalizing regardless of choice, breaking the whole two-stage flow.
    if (body.data.choice === "PLACE_TWO_MORE" && !g.swap2TwoMoreChosen) {
      g.swap2TwoMoreChosen = true;
      return ok(gameState(g), "200000", "放第四、五子，續放 2 子後由對手選色");
    }
    // Finalize colors -> enter PLAYING. After 3 (or 5, if PLACE_TWO_MORE was
    // taken) opening stones it is White's turn in the running game.
    g.status = "PLAYING";
    g.currentTurn = "WHITE";
    return ok(gameState(g), "200000", "選擇完成，進入正式對局");
  }),

  http.post(p("/games/:gameId/actions/rematch"), ({ params }) => {
    const gameId = String(params.gameId);
    const oldDuel = duelGames.get(gameId);
    if (oldDuel) {
      const g = createDuelGame({
        gameId: `${gameId}-r${Date.now().toString(36)}`,
        fieldType: oldDuel.fieldType,
        blackClass: oldDuel.blackClass,
        whiteClass: oldDuel.whiteClass,
        gameMode: oldDuel.gameMode,
      });
      return created(duelGameDetail(g), "新局已建立");
    }
    const old = games.get(gameId);
    const useSwap2 = old?.useSwap2 ?? false;
    const mode = old?.gameMode ?? "LOCAL";
    return created(gameDetail(newGame(useSwap2, mode)), "新局已建立");
  }),

  http.get(p("/games/:gameId/replay"), ({ params }) => {
    ensureDemoDuelGames();
    const gameId = String(params.gameId);
    // live duel games replay from the engine's recorded event timeline
    const dg = duelGames.get(gameId);
    if (dg) return ok(duelGameReplay(dg));
    // mock-created games replay their own move log — falling through to the
    // demo fixture here used to pollute every fresh game's board rebuild
    const g = games.get(gameId);
    if (g) return ok(gameReplay(g));
    // curated duel replay fixture（需求 #47 示例：沙灘場地完整事件時間軸）
    if (gameId === duelReplayGame.gameId) return ok(duelReplayGame);
    // unknown id: keep the demo fixture (smoke test navigates to /replay/g1)
    return ok({ ...replayGame, gameId });
  }),

  // ── pve 挑戰模式 (tags:[pve], api.yml:747-1073) ──────────────
  // Solo REST-only mode (no STOMP channel exists for pve — pve-api-spec.md
  // §0.4). Logic lives in ./pveEngine; these handlers only do auth/body
  // validation + envelope wrapping, same split as the rooms/games section.
  http.post(p("/pve/runs"), async ({ request }) => {
    const unauthorized = requirePveAuth(request, PVE_ERROR.GUEST_FORBIDDEN);
    if (unauthorized) return unauthorized;
    const body = PveRunCreateRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422000", "職業選擇不合法");
    const res = createPveRun(body.data.classType, body.data.seed ?? undefined);
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return created(res.data, "Run已建立");
  }),

  http.get(p("/pve/runs/current"), ({ request }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const res = getCurrentPveRun();
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return ok(res.data);
  }),

  http.post(p("/pve/runs/:runId/actions/abandon"), ({ params }) => {
    const res = abandonPveRun(String(params.runId));
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return ok(res.data, "200000", "已放棄");
  }),

  http.get(p("/pve/runs/:runId/result"), ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const res = getPveRunResult(String(params.runId));
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return ok(res.data);
  }),

  http.get(p("/pve/encounters/:encounterId"), ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const res = getPveEncounter(String(params.encounterId));
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return ok(res.data);
  }),

  http.post(p("/pve/encounters/:encounterId/moves"), async ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const body = PveMoveCreateRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422000", "落子位置超出棋盤");
    const res = placePveMove(String(params.encounterId), body.data.row, body.data.col);
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return created(res.data, "落子成功");
  }),

  http.post(p("/pve/encounters/:encounterId/actions/use-skill"), async ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const body = PveSkillUseRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422000", "技能使用資料不合法");
    const res = usePveSkill(String(params.encounterId), body.data);
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return created(res.data, "技能已使用");
  }),

  // 2026-07-09 §1.5/§6.5 公平性修正：重試和局的魔王對弈關（DUEL限定、狀態須為DRAW）。
  http.post(p("/pve/encounters/:encounterId/actions/retry"), ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const res = retryPveEncounter(String(params.encounterId));
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return created(res.data, "已重試");
  }),

  http.get(p("/pve/runs/:runId/shop"), ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const res = getPveShop(String(params.runId));
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return ok(res.data);
  }),

  http.post(p("/pve/runs/:runId/shop/actions/purchase"), async ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const body = PveShopPurchaseRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422000", "購買資料不合法");
    const res = purchasePveShopOffer(String(params.runId), body.data.slotIndex);
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return ok(res.data, "200000", "購買成功");
  }),

  http.post(p("/pve/runs/:runId/shop/actions/reroll"), ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const res = rerollPveShop(String(params.runId));
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return ok(res.data, "200000", "重抽成功");
  }),

  http.post(p("/pve/runs/:runId/shop/actions/skip"), ({ request, params }) => {
    const unauthorized = requirePveAuth(request);
    if (unauthorized) return unauthorized;
    const res = skipPveShop(String(params.runId));
    if (!res.ok) return fail(res.httpStatus, res.code, res.message);
    return ok(res.data, "200000", "已跳過商店");
  }),
];
