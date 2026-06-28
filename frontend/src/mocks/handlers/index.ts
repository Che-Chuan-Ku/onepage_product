import { http, HttpResponse } from "msw";
import { API_BASE } from "@/lib/api/config";
import {
  RegisterRequest,
  LoginRequest,
  GuestEnterRequest,
  RoomCreateRequest,
  LocalGameCreateRequest,
  MoveCreateRequest,
  OpeningStoneCreateRequest,
  Swap2ChoiceRequest,
  type Color,
  type GameStatus,
  type GameResult,
} from "@/lib/types/schemas";
import { checkWin, key, type Board } from "@/lib/game/winCheck";
import {
  leaderboard,
  myStats,
  publicRooms,
  makeRoomDetail,
  replayGame,
} from "../data/fixtures";

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
    lastMove: null,
    result: null,
    winningLine: null,
  };
  games.set(gameId, g);
  return g;
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

const p = (path: string) => `${API_BASE}${path}`;

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
    const roomId = `r-${Date.now().toString(36)}`;
    return created(
      makeRoomDetail(roomId, {
        roomCode: Math.random().toString(36).slice(2, 6).toUpperCase(),
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
    const g = games.get(String(params.gameId));
    if (!g) return fail(404, "404001", "對局不存在");
    const body = MoveCreateRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422001", "落子位置超出棋盤");
    const { row, col } = body.data;
    if (g.status !== "PLAYING" || g.currentTurn == null)
      return fail(422, "422003", "目前無法落子");
    if (g.board[key(row, col)]) return fail(422, "422002", "該位置已有棋子");

    const color = g.currentTurn;
    g.board[key(row, col)] = color;
    g.moveCount += 1;
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
    if (g.openingStones.length >= 3) return fail(422, "422002", "開局子已滿 3 顆");
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
    if (g.openingStones.length < 3 && g.status === "OPENING") {
      // PLACE_TWO_MORE branch may legitimately have <5; keep simple: require >=3
    }
    const body = Swap2ChoiceRequest.safeParse(await request.json());
    if (!body.success) return fail(422, "422001", "選擇不合法");
    // Finalize colors -> enter PLAYING. After 3 opening stones (B,W,B) it is
    // White's turn in the running game.
    g.status = "PLAYING";
    g.currentTurn = "WHITE";
    return ok(gameState(g), "200000", "選擇完成，進入正式對局");
  }),

  http.post(p("/games/:gameId/actions/rematch"), ({ params }) => {
    const old = games.get(String(params.gameId));
    const useSwap2 = old?.useSwap2 ?? false;
    const mode = old?.gameMode ?? "LOCAL";
    return created(gameDetail(newGame(useSwap2, mode)), "新局已建立");
  }),

  http.get(p("/games/:gameId/replay"), ({ params }) =>
    ok({ ...replayGame, gameId: String(params.gameId) }),
  ),
];
