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

// ── Serious-duel enums (api.yml 需求 #34–#47) ────────────────
export const BattleMode = z.enum(["NORMAL", "SERIOUS_DUEL"]);
export type BattleMode = z.infer<typeof BattleMode>;
export const FieldType = z.enum(["VOLCANO", "BEACH"]);
export type FieldType = z.infer<typeof FieldType>;
export const ClassType = z.enum(["WARRIOR", "ARCHER"]);
export type ClassType = z.infer<typeof ClassType>;
export const SkillType = z.enum([
  "HORIZONTAL_SLASH",
  "VERTICAL_SLASH",
  "HEAVEN_EARTH_REVERSAL",
  "PRECISION_SNIPE",
  "SCATTER_SHOT",
  "PIONEER_STAR",
]);
export type SkillType = z.infer<typeof SkillType>;
export const UltimateSkillType = z.enum(["HEAVEN_EARTH_REVERSAL", "PIONEER_STAR"]);
export type UltimateSkillType = z.infer<typeof UltimateSkillType>;
export const SkillDirection = z.enum(["UP", "DOWN", "LEFT", "RIGHT"]);
export type SkillDirection = z.infer<typeof SkillDirection>;
export const SkillEventType = z.enum([
  "FIELD_GENERATED",
  "STONE_PUSHED",
  "STONE_REMOVED_OFF_BOARD",
  "STONES_BURNED",
  "STONE_REPLACED",
  "STONES_CLEARED",
  "COLORS_SWAPPED",
  "VOLCANO_ERUPTED",
  "WAVE_SURGED",
  "TIDE_TRIGGERED",
  "TIDE_RISEN",
  "SAND_ERODED",
]);
export type SkillEventType = z.infer<typeof SkillEventType>;
export const HiddenCellKind = z.enum(["ERUPTION", "TIDE"]);
export type HiddenCellKind = z.infer<typeof HiddenCellKind>;

export const Cell = z.object({ row: z.number().int(), col: z.number().int() });
export type Cell = z.infer<typeof Cell>;

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
  // 真劍勝負（需求 #34，Q9）: SERIOUS_DUEL is mutually exclusive with
  // isSwap2Mode and requires fieldType — enforced at handler level (422),
  // not in the schema, so the error carries the api.yml business code.
  battleMode: BattleMode.default("NORMAL"),
  fieldType: FieldType.nullable().optional(),
});
export type RoomCreateRequest = z.infer<typeof RoomCreateRequest>;
// Input-side type: battleMode/isSwap2Mode have defaults, so existing call
// sites may omit them (api.yml: battleMode default NORMAL).
export type RoomCreateRequestInput = z.input<typeof RoomCreateRequest>;

export const SelectClassRequest = z.object({
  classType: ClassType,
});
export type SelectClassRequest = z.infer<typeof SelectClassRequest>;

export const RoomMemberItem = z.object({
  playerId: z.string(),
  nickname: z.string(),
  role: RoomRole,
  isReady: z.boolean(),
  // Serious duel only. Own selection is echoed back; the opponent's stays
  // null until ClassesRevealed (game start). Optional so NORMAL-mode
  // payloads without the field still validate.
  classType: ClassType.nullable().optional(),
});
export type RoomMemberItem = z.infer<typeof RoomMemberItem>;

export const RoomDetailResponse = z.object({
  roomId: z.string(),
  roomCode: z.string(),
  visibility: RoomVisibility,
  status: RoomStatus,
  isSwap2Mode: z.boolean(),
  // Additive duel fields — optional to tolerate backends that predate #34.
  battleMode: BattleMode.optional(),
  fieldType: FieldType.nullable().optional(),
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
  battleMode: BattleMode.optional(),
  fieldType: FieldType.nullable().optional(),
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
  battleMode: BattleMode.optional(),
  fieldType: FieldType.nullable().optional(),
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

// Serious-duel skill payload (api.yml SkillActionRequest, 需求 #36 #42 #43).
export const SkillActionRequest = z.object({
  skillType: SkillType,
  // HORIZONTAL_SLASH: UP/DOWN; VERTICAL_SLASH: LEFT/RIGHT; ultimates: any.
  direction: SkillDirection.nullable().optional(),
  // Ultimate anchor — must be an empty cell (validated by the engine).
  anchor: Cell.nullable().optional(),
  // PRECISION_SNIPE: coordinates of an existing enemy stone.
  target: Cell.nullable().optional(),
  // SCATTER_SHOT: second stone, Chebyshev distance >= 2 from row/col.
  secondStone: Cell.nullable().optional(),
});
export type SkillActionRequest = z.infer<typeof SkillActionRequest>;

/**
 * MoveCreateRequest — oneOf (api.yml 需求 #36):
 * Normal = row/col required (0..15 = union upper bound of both fields; the
 * effective bound — 14 for VOLCANO / normal games, 15 for BEACH — is
 * re-validated per fieldType by the backend/mock engine, 422 beyond it),
 * optionally carrying a regular skill.
 * Ultimate = skill only (HEAVEN_EARTH_REVERSAL / PIONEER_STAR, anchor
 * required); row/col are forbidden.
 */
export const MoveCreateRequestNormal = z.object({
  row: z.number().int().min(0).max(15),
  col: z.number().int().min(0).max(15),
  skill: SkillActionRequest.optional(),
});
export type MoveCreateRequestNormal = z.infer<typeof MoveCreateRequestNormal>;

// .strict() rejects extra keys, so a payload carrying row/col can never
// match this branch (api.yml: ultimate forbids row/col).
export const MoveCreateRequestUltimate = z
  .object({
    skill: SkillActionRequest.extend({
      skillType: UltimateSkillType,
      anchor: Cell,
    }),
  })
  .strict();
export type MoveCreateRequestUltimate = z.infer<typeof MoveCreateRequestUltimate>;

export const MoveCreateRequest = z.union([
  MoveCreateRequestNormal,
  MoveCreateRequestUltimate,
]);
export type MoveCreateRequest = z.infer<typeof MoveCreateRequest>;

// Serious-duel field snapshot; hidden cells (untriggered ERUPTION/TIDE)
// never appear here (需求 #44).
export const FieldState = z.object({
  fieldType: FieldType,
  obstacles: z.array(Cell),
  // Beach ocean-start side (api.yml:1057-1061, 需求 #40); BEACH only, tolerant
  // like the other beach-only fields (erodedRows/tideTriggered/roundCounter).
  seaSide: z.enum(["NORTH", "SOUTH", "EAST", "WEST"]).nullable().optional(),
  erodedRows: z.number().int(),
  tideTriggered: z.boolean(),
  roundCounter: z.number().int(),
});
export type FieldState = z.infer<typeof FieldState>;

export const RevealedHiddenCell = z.object({
  cellKind: HiddenCellKind,
  row: z.number().int(),
  col: z.number().int(),
});
export type RevealedHiddenCell = z.infer<typeof RevealedHiddenCell>;

export const SkillEvent = z.object({
  eventType: SkillEventType,
  row: z.number().int().nullable(),
  col: z.number().int().nullable(),
  effectTriggered: z.boolean(),
});
export type SkillEvent = z.infer<typeof SkillEvent>;

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
  // ── Serious-duel additive fields (NORMAL games send them as explicit
  // JSON null, not omitted — GameStateResponse.java is annotated
  // @JsonInclude(ALWAYS) — so every one of these needs BOTH .nullable()
  // AND .optional(); .optional() alone rejects an explicit `null` value.
  // Bug fix: revealedHiddenCells/skillEvents were missing .nullable(), so
  // .parse() threw a ZodError on every single NORMAL-mode placeMove
  // response, silently swallowed by the caller's catch(ApiError) branch as
  // a bogus "落子不合法" toast — every move appeared to do nothing (server
  // accepted it, but the board/turn/moveCount never updated on screen).
  blackClass: ClassType.nullable().optional(),
  whiteClass: ClassType.nullable().optional(),
  fieldState: FieldState.nullable().optional(),
  // Hidden cells newly triggered by this settlement (需求 #44).
  revealedHiddenCells: z.array(RevealedHiddenCell).nullable().optional(),
  // Skill/field events produced by this settlement (需求 #37 #38 #45).
  skillEvents: z.array(SkillEvent).nullable().optional(),
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
// Serious-duel skill/field event timeline entry (需求 #47).
// Bug fix: real backend's FIELD_GENERATED entry carries moveNumber=null (it
// happens at build time, before any move — see erm.dbml field_events.move_
// number "FIELD_GENERATED 於建局時發生，move_number 為 null"). moveNumber was
// missing .nullable() here (row/col already had it), so .parse() threw a
// ZodError on every SERIOUS_DUEL /replay response, silently swallowed by
// loadReplay()'s empty catch — duel never entered its branch, so obstacles /
// skill bar / class badges never rendered (silent degrade to a blank board).
export const FieldEventItem = z.object({
  moveNumber: z.number().int().nullable(),
  eventType: SkillEventType,
  row: z.number().int().nullable(),
  col: z.number().int().nullable(),
});
export type FieldEventItem = z.infer<typeof FieldEventItem>;
export const GameReplayResponse = z.object({
  gameId: z.string(),
  // nullable: 未結束的對局 result 為 null，否則 zod 解析失敗 → 回放整頁 0/0 載不出來。
  result: GameResult.nullable(),
  winnerPlayerId: z.string().nullable(),
  moveCount: z.number().int(),
  useSwap2: z.boolean(),
  // Additive (bug fix): authoritative whose-turn-now for page-load/reconnect;
  // moveCount parity is unreliable for Serious Duel (ultimates place 0 stones,
  // scatter-shot places 2 in one hand). null once FINISHED.
  currentTurn: Color.nullable().optional(),
  // ── Serious-duel additive fields (optional for NORMAL replays) ──
  battleMode: BattleMode.optional(),
  fieldType: FieldType.nullable().optional(),
  blackClass: ClassType.nullable().optional(),
  whiteClass: ClassType.nullable().optional(),
  fieldEvents: z.array(FieldEventItem).optional(),
  // Additive (bug fix): per-player used-skill history so the game page can
  // restore its client-tracked usedSkills state on reconnect/reload (R2-3).
  skillUsages: z.array(z.object({ playerId: z.string(), skillType: SkillType })).optional(),
  // Additive (bug fix): fieldEvents' FIELD_GENERATED entries carry row=col=null
  // on the real backend, so obstacle layout / beach ocean side cannot be
  // inferred from fieldEvents alone (primary/replay path was silently wrong —
  // BEACH always defaulted to ocean-on-UP). Authoritative snapshot mirroring
  // GameStateResponse.fieldState.
  obstacles: z.array(z.object({ row: z.number().int(), col: z.number().int() })).optional(),
  seaSide: z.enum(["NORTH", "SOUTH", "EAST", "WEST"]).nullable().optional(),
  openingStones: z.array(ReplayOpeningStone),
  moves: z.array(ReplayMove),
  // Additive fields (bug fix): lets the game page resolve real nicknames +
  // correct black/white chip mapping instead of hardcoded placeholder names.
  // null for LOCAL games / not-yet-assigned online games.
  roomId: z.string().nullable().optional(),
  blackPlayerId: z.string().nullable().optional(),
  whitePlayerId: z.string().nullable().optional(),
});
export type GameReplayResponse = z.infer<typeof GameReplayResponse>;
