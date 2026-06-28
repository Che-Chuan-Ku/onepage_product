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
  { roomId: "r-7f3k", roomCode: "7F3K", hostNickname: "阿哲", playerCount: 1, spectatorCount: 2, isSwap2Mode: true },
  { roomId: "r-a12x", roomCode: "A12X", hostNickname: "小美", playerCount: 2, spectatorCount: 5, isSwap2Mode: false },
  { roomId: "r-qq88", roomCode: "QQ88", hostNickname: "老張", playerCount: 1, spectatorCount: 0, isSwap2Mode: false },
  { roomId: "r-ku99", roomCode: "KU99", hostNickname: "快手小王", playerCount: 0, spectatorCount: 1, isSwap2Mode: true },
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
