import { z } from "zod";

/**
 * Zod schemas — strict mirror of specs/api.yml components.schemas.
 * Single source of truth for request/response shapes; MSW handlers,
 * the API client, and UI all consume these.
 */

// ── Envelope ────────────────────────────────────────────────
export const ManageResponse = z.object({
  status: z.string(),
  code: z.string(),
  message: z.string(),
});
export type ManageResponse = z.infer<typeof ManageResponse>;

/** Wrap a data payload in the standard ManageResponse envelope. */
export const envelope = <T extends z.ZodTypeAny>(data: T) =>
  ManageResponse.extend({ data });

export const ManagePageResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    totalCount: z.number().int(),
  });

// ── Enums ───────────────────────────────────────────────────
export const Color = z.enum(["BLACK", "WHITE"]);
export type Color = z.infer<typeof Color>;

export const GameResult = z.enum(["BLACK_WIN", "WHITE_WIN", "DRAW"]);
export type GameResult = z.infer<typeof GameResult>;

export const GameStatus = z.enum(["OPENING", "PLAYING", "FINISHED"]);
export type GameStatus = z.infer<typeof GameStatus>;

export const GameMode = z.enum(["LOCAL", "ONLINE"]);
export type GameMode = z.infer<typeof GameMode>;

export const RoomStatus = z.enum(["WAITING", "READY", "IN_PROGRESS", "FINISHED"]);
export type RoomStatus = z.infer<typeof RoomStatus>;
export const RoomVisibility = z.enum(["PUBLIC", "PRIVATE"]);
export type RoomVisibility = z.infer<typeof RoomVisibility>;
export const RoomRole = z.enum(["PLAYER", "SPECTATOR"]);
export type RoomRole = z.infer<typeof RoomRole>;
export const Swap2Choice = z.enum(["TAKE_BLACK", "TAKE_WHITE", "PLACE_TWO_MORE"]);
export type Swap2Choice = z.infer<typeof Swap2Choice>;
export const CoinSide = z.enum(["HEADS", "TAILS"]);

// ── Auth ────────────────────────────────────────────────────
export const RegisterRequest = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  // 最短 8 碼，須同時含英文小寫字母與數字 (Q3)
  password: z.string().regex(/^(?=.*[a-z])(?=.*\d).{8,}$/, {
    message: "密碼最短 8 碼，須同時含英文小寫字母與數字",
  }),
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const LoginRequest = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const LoginResponse = z.object({
  token: z.string(),
  playerId: z.string(),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

export const GuestEnterRequest = z.object({
  nickname: z.string().min(1),
});
export type GuestEnterRequest = z.infer<typeof GuestEnterRequest>;

export const GuestEnterResponse = z.object({
  guestId: z.string(),
  nickname: z.string(),
  // Additive field from the real backend: JWT for the guest's online
  // single-game session (/rooms/** is authenticated). Optional so MSW
  // fixtures without it still validate.
  token: z.string().optional(),
});
export type GuestEnterResponse = z.infer<typeof GuestEnterResponse>;

export const PlayerDetailResponse = z.object({
  playerId: z.string(),
  username: z.string(),
  email: z.string(),
});
export type PlayerDetailResponse = z.infer<typeof PlayerDetailResponse>;

// ── Players / Leaderboard ───────────────────────────────────
export const RecentGameItem = z.object({
  gameId: z.string(),
  result: GameResult,
  endedAt: z.string(),
});
export type RecentGameItem = z.infer<typeof RecentGameItem>;

export const PlayerStatsResponse = z.object({
  playerId: z.string(),
  wins: z.number().int(),
  losses: z.number().int(),
  draws: z.number().int(),
  winRate: z.number(),
  recentGames: z.array(RecentGameItem),
});
export type PlayerStatsResponse = z.infer<typeof PlayerStatsResponse>;

export const LeaderboardEntryResponse = z.object({
  rank: z.number().int(),
  playerId: z.string(),
  username: z.string(),
  wins: z.number().int(),
  losses: z.number().int(),
  winRate: z.number(),
});
export type LeaderboardEntryResponse = z.infer<typeof LeaderboardEntryResponse>;

// ── Rooms ───────────────────────────────────────────────────
export const RoomCreateRequest = z.object({
  visibility: RoomVisibility,
  isSwap2Mode: z.boolean().default(false),
});
export type RoomCreateRequest = z.infer<typeof RoomCreateRequest>;

export const RoomMemberItem = z.object({
  playerId: z.string(),
  nickname: z.string(),
  role: RoomRole,
  isReady: z.boolean(),
});
export type RoomMemberItem = z.infer<typeof RoomMemberItem>;

export const RoomDetailResponse = z.object({
  roomId: z.string(),
  roomCode: z.string(),
  visibility: RoomVisibility,
  status: RoomStatus,
  isSwap2Mode: z.boolean(),
  hostPlayerId: z.string().nullable().optional(),
  joinedAsRole: RoomRole.nullable().optional(),
  spectatorCount: z.number().int(),
  members: z.array(RoomMemberItem),
});
export type RoomDetailResponse = z.infer<typeof RoomDetailResponse>;

export const RoomListResponse = z.object({
  roomId: z.string(),
  roomCode: z.string(),
  hostNickname: z.string(),
  playerCount: z.number().int(),
  spectatorCount: z.number().int(),
  isSwap2Mode: z.boolean(),
});
export type RoomListResponse = z.infer<typeof RoomListResponse>;

export const QuickMatchResponse = z.object({
  matched: z.boolean(),
  roomId: z.string().nullable(),
  queuePosition: z.number().int().nullable(),
});
export type QuickMatchResponse = z.infer<typeof QuickMatchResponse>;

// ── Games ───────────────────────────────────────────────────
export const LocalGameCreateRequest = z.object({
  useSwap2: z.boolean().default(false),
  blackNickname: z.string().optional(),
  whiteNickname: z.string().optional(),
});
export type LocalGameCreateRequest = z.infer<typeof LocalGameCreateRequest>;

export const GameDetailResponse = z.object({
  gameId: z.string(),
  gameMode: GameMode,
  useSwap2: z.boolean(),
  status: GameStatus,
  currentTurn: Color.nullable(),
});
export type GameDetailResponse = z.infer<typeof GameDetailResponse>;

/** start-game / GameStarted 廣播：含假先方 id 供 opening 頁判角色。 */
export const GameStartedEvent = z.object({
  event: z.string().optional(),
  gameId: z.string(),
  useSwap2: z.boolean(),
  status: GameStatus,
  tentativeFirstPlayerId: z.string().nullable().optional(),
  blackPlayerId: z.string().nullable().optional(),
  whitePlayerId: z.string().nullable().optional(),
});
export type GameStartedEvent = z.infer<typeof GameStartedEvent>;

export const CoinTossResponse = z.object({
  gameId: z.string(),
  coinResult: CoinSide,
  tentativeFirstPlayerId: z.string().nullable(),
  blackPlayerId: z.string().nullable(),
  whitePlayerId: z.string().nullable(),
});
export type CoinTossResponse = z.infer<typeof CoinTossResponse>;

export const MoveCreateRequest = z.object({
  row: z.number().int().min(0).max(14),
  col: z.number().int().min(0).max(14),
});
export type MoveCreateRequest = z.infer<typeof MoveCreateRequest>;

export const Cell = z.object({ row: z.number().int(), col: z.number().int() });
export type Cell = z.infer<typeof Cell>;

export const GameStateResponse = z.object({
  gameId: z.string(),
  status: GameStatus,
  currentTurn: Color.nullable(),
  moveCount: z.number().int(),
  lastMove: z
    .object({ color: Color, row: z.number().int(), col: z.number().int() })
    .nullable(),
  result: GameResult.nullable(),
  winningLine: z.array(Cell).nullable(),
});
export type GameStateResponse = z.infer<typeof GameStateResponse>;

export const OpeningStoneCreateRequest = z.object({
  row: z.number().int().min(0).max(14),
  col: z.number().int().min(0).max(14),
  color: Color,
});
export type OpeningStoneCreateRequest = z.infer<typeof OpeningStoneCreateRequest>;

export const Swap2ChoiceRequest = z.object({ choice: Swap2Choice });
export type Swap2ChoiceRequest = z.infer<typeof Swap2ChoiceRequest>;

// ── History / Replay ────────────────────────────────────────
export const ReplayOpeningStone = z.object({
  sequence: z.number().int(),
  color: Color,
  row: z.number().int(),
  col: z.number().int(),
});
export const ReplayMove = z.object({
  moveNumber: z.number().int(),
  color: Color,
  row: z.number().int(),
  col: z.number().int(),
});
export const GameReplayResponse = z.object({
  gameId: z.string(),
  // nullable: 未結束的對局 result 為 null，否則 zod 解析失敗 → 回放整頁 0/0 載不出來。
  result: GameResult.nullable(),
  winnerPlayerId: z.string().nullable(),
  moveCount: z.number().int(),
  useSwap2: z.boolean(),
  openingStones: z.array(ReplayOpeningStone),
  moves: z.array(ReplayMove),
});
export type GameReplayResponse = z.infer<typeof GameReplayResponse>;
