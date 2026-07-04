import type {
  LeaderboardEntryResponse,
  RoomListResponse,
  RoomDetailResponse,
  PlayerStatsResponse,
  GameReplayResponse,
} from "@/lib/types/schemas";

/**
 * Data-driven fixtures for the MSW layer. Values mirror the P3 prototype's
 * hard-coded demo data so the Next.js app shows the same content the
 * prototype reviewers signed off on. Q2 leaderboard rule (wins DESC, winRate
 * DESC, threshold wins+losses >= 10) is encoded directly in the ordering.
 */

export const leaderboard: LeaderboardEntryResponse[] = [
  { rank: 1, playerId: "p-zhe", username: "棋聖阿哲", wins: 152, losses: 35, winRate: 0.813 },
  { rank: 2, playerId: "p-mei", username: "小美", wins: 140, losses: 44, winRate: 0.76 },
  { rank: 3, playerId: "p-zhang", username: "老張", wins: 120, losses: 51, winRate: 0.702 },
  { rank: 4, playerId: "p-wang", username: "快手小王", wins: 95, losses: 53, winRate: 0.64 },
  { rank: 5, playerId: "p-001", username: "KuPlayer", wins: 28, losses: 14, winRate: 0.667 },
];

export const myStats: PlayerStatsResponse = {
  playerId: "p-001",
  wins: 28,
  losses: 14,
  draws: 0,
  winRate: 0.667,
  recentGames: [
    { gameId: "g1", result: "BLACK_WIN", endedAt: "2026-05-24T12:00:00+08:00" },
    { gameId: "g2", result: "WHITE_WIN", endedAt: "2026-05-23T20:30:00+08:00" },
    { gameId: "g3", result: "BLACK_WIN", endedAt: "2026-05-22T18:10:00+08:00" },
  ],
};

export const publicRooms: RoomListResponse[] = [
  { roomId: "r-7f3k", roomCode: "7F3K", hostNickname: "阿哲", playerCount: 1, spectatorCount: 2, isSwap2Mode: true, battleMode: "NORMAL", fieldType: null },
  { roomId: "r-a12x", roomCode: "A12X", hostNickname: "小美", playerCount: 2, spectatorCount: 5, isSwap2Mode: false, battleMode: "NORMAL", fieldType: null },
  { roomId: "r-qq88", roomCode: "QQ88", hostNickname: "老張", playerCount: 1, spectatorCount: 0, isSwap2Mode: false, battleMode: "NORMAL", fieldType: null },
  { roomId: "r-ku99", roomCode: "KU99", hostNickname: "快手小王", playerCount: 0, spectatorCount: 1, isSwap2Mode: true, battleMode: "NORMAL", fieldType: null },
  // Serious-duel room so the lobby list exercises battleMode/fieldType (#34)
  { roomId: "r-duel", roomCode: "DUEL1", hostNickname: "阿哲", playerCount: 1, spectatorCount: 0, isSwap2Mode: false, battleMode: "SERIOUS_DUEL", fieldType: "VOLCANO" },
];

export function makeRoomDetail(
  roomId: string,
  overrides: Partial<RoomDetailResponse> = {},
): RoomDetailResponse {
  const base = publicRooms.find((r) => r.roomId === roomId);
  return {
    roomId,
    roomCode: base?.roomCode ?? "7F3K",
    visibility: "PUBLIC",
    status: "WAITING",
    isSwap2Mode: base?.isSwap2Mode ?? true,
    battleMode: base?.battleMode ?? "NORMAL",
    fieldType: base?.fieldType ?? null,
    joinedAsRole: "PLAYER",
    spectatorCount: base?.spectatorCount ?? 2,
    members: [
      { playerId: "p-zhe", nickname: "阿哲", role: "PLAYER", isReady: true },
      { playerId: "p-001", nickname: "KuPlayer", role: "PLAYER", isReady: false },
    ],
    ...overrides,
  };
}

/** Replay fixture matching prototype/replay (Swap2, black vertical win col 7). */
export const replayGame: GameReplayResponse = {
  gameId: "g1",
  result: "BLACK_WIN",
  winnerPlayerId: "p-zhe",
  moveCount: 6,
  useSwap2: true,
  openingStones: [
    { sequence: 1, color: "BLACK", row: 7, col: 7 },
    { sequence: 2, color: "WHITE", row: 7, col: 8 },
    { sequence: 3, color: "BLACK", row: 8, col: 7 },
  ],
  moves: [
    { moveNumber: 1, color: "WHITE", row: 8, col: 8 },
    { moveNumber: 2, color: "BLACK", row: 6, col: 7 },
    { moveNumber: 3, color: "WHITE", row: 9, col: 6 },
    { moveNumber: 4, color: "BLACK", row: 5, col: 7 },
    { moveNumber: 5, color: "WHITE", row: 8, col: 6 },
    { moveNumber: 6, color: "BLACK", row: 4, col: 7 },
  ],
};

/**
 * Serious-duel replay fixture (需求 #47) — beach field, 16x16, ocean on the
 * UP side (rows 0..7). Timeline showcases every replay-relevant event kind:
 * FIELD_GENERATED (move 0), WAVE_SURGED + chain STONE_PUSHED (moves 10/20),
 * TIDE_TRIGGERED at the hidden cell's trigger moment (move 11, cell 12,5),
 * archer STONE_REPLACED (move 12), warrior slash pushes (move 15), and
 * TIDE_RISEN/SAND_ERODED eroding beach row 8 on the armed wave (move 20).
 * Black (WARRIOR) wins with row 12, cols 5–9.
 */
export const duelReplayGame: GameReplayResponse = {
  gameId: "duel-replay-beach",
  result: "BLACK_WIN",
  winnerPlayerId: "p-001",
  moveCount: 25,
  useSwap2: false,
  battleMode: "SERIOUS_DUEL",
  fieldType: "BEACH",
  blackClass: "WARRIOR",
  whiteClass: "ARCHER",
  openingStones: [],
  moves: [
    { moveNumber: 1, color: "BLACK", row: 10, col: 7 },
    { moveNumber: 2, color: "WHITE", row: 9, col: 8 },
    { moveNumber: 3, color: "BLACK", row: 7, col: 7 },
    { moveNumber: 4, color: "WHITE", row: 6, col: 7 },
    { moveNumber: 5, color: "BLACK", row: 10, col: 8 },
    { moveNumber: 6, color: "WHITE", row: 9, col: 9 },
    { moveNumber: 7, color: "BLACK", row: 11, col: 6 },
    { moveNumber: 8, color: "WHITE", row: 5, col: 7 },
    { moveNumber: 9, color: "BLACK", row: 10, col: 9 },
    { moveNumber: 10, color: "WHITE", row: 9, col: 7 },
    { moveNumber: 11, color: "BLACK", row: 12, col: 5 },
    { moveNumber: 12, color: "WHITE", row: 10, col: 8 }, // PRECISION_SNIPE replace
    { moveNumber: 13, color: "BLACK", row: 11, col: 8 },
    { moveNumber: 14, color: "WHITE", row: 11, col: 9 },
    { moveNumber: 15, color: "BLACK", row: 12, col: 7 }, // HORIZONTAL_SLASH UP
    { moveNumber: 16, color: "WHITE", row: 4, col: 4 },
    { moveNumber: 17, color: "BLACK", row: 13, col: 6 },
    { moveNumber: 18, color: "WHITE", row: 4, col: 5 },
    { moveNumber: 19, color: "BLACK", row: 12, col: 6 },
    { moveNumber: 20, color: "WHITE", row: 3, col: 4 },
    { moveNumber: 21, color: "BLACK", row: 12, col: 8 },
    { moveNumber: 22, color: "WHITE", row: 2, col: 2 },
    { moveNumber: 23, color: "BLACK", row: 13, col: 7 },
    { moveNumber: 24, color: "WHITE", row: 2, col: 3 },
    { moveNumber: 25, color: "BLACK", row: 12, col: 9 },
  ],
  fieldEvents: [
    // ocean-edge centre cell = mock convention for "ocean on the UP side"
    // (api.yml fieldState has no oceanSide; the UI infers it from this cell)
    { moveNumber: 0, eventType: "FIELD_GENERATED", row: 0, col: 8 },
    // 1st wave (10 half-moves): ocean column-7 stones chain-pushed beachward
    { moveNumber: 10, eventType: "WAVE_SURGED", row: null, col: null },
    { moveNumber: 10, eventType: "STONE_PUSHED", row: 7, col: 7 },
    { moveNumber: 10, eventType: "STONE_PUSHED", row: 6, col: 7 },
    { moveNumber: 10, eventType: "STONE_PUSHED", row: 5, col: 7 },
    // hidden tide cell (12,5) stepped on → armed + revealed
    { moveNumber: 11, eventType: "TIDE_TRIGGERED", row: 12, col: 5 },
    // archer snipe replaces the black stone at (10,8)
    { moveNumber: 12, eventType: "STONE_REPLACED", row: 10, col: 8 },
    // warrior horizontal slash (UP) pushes the row-11 stones
    { moveNumber: 15, eventType: "STONE_PUSHED", row: 11, col: 6 },
    { moveNumber: 15, eventType: "STONE_PUSHED", row: 11, col: 8 },
    // 2nd wave; tide armed → beach row 8 eroded into ocean
    { moveNumber: 20, eventType: "WAVE_SURGED", row: null, col: null },
    { moveNumber: 20, eventType: "STONE_PUSHED", row: 4, col: 4 },
    { moveNumber: 20, eventType: "STONE_PUSHED", row: 4, col: 5 },
    { moveNumber: 20, eventType: "STONE_PUSHED", row: 3, col: 4 },
    { moveNumber: 20, eventType: "TIDE_RISEN", row: 8, col: null },
    { moveNumber: 20, eventType: "SAND_ERODED", row: 8, col: null },
  ],
};
