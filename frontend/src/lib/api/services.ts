import { api } from "./client";
import {
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  GuestEnterRequest,
  GuestEnterResponse,
  PlayerDetailResponse,
  PlayerStatsResponse,
  LeaderboardEntryResponse,
  ManagePageResponse,
  RoomCreateRequest,
  RoomDetailResponse,
  RoomListResponse,
  QuickMatchResponse,
  LocalGameCreateRequest,
  GameDetailResponse,
  GameStartedEvent,
  CoinTossResponse,
  MoveCreateRequest,
  GameStateResponse,
  OpeningStoneCreateRequest,
  Swap2ChoiceRequest,
  GameReplayResponse,
} from "@/lib/types/schemas";

/**
 * Service layer — one function per api.yml operationId. UI/stores call these
 * exclusively; swapping MSW for the real backend requires zero call-site edits.
 */

// ── auth ──────────────────────────────────────────────────────
export const authService = {
  register: (body: RegisterRequest) =>
    api.post("/auth/register", PlayerDetailResponse, body),
  login: (body: LoginRequest) => api.post("/auth/login", LoginResponse, body),
  guest: (body: GuestEnterRequest) =>
    api.post("/auth/guest", GuestEnterResponse, body),
};

// ── players / leaderboard ─────────────────────────────────────
const LeaderboardPage = ManagePageResponse(LeaderboardEntryResponse);
export const playerService = {
  stats: (playerId: string) =>
    api.get(`/players/${playerId}/stats`, PlayerStatsResponse),
  leaderboard: (params?: { skip?: number; top?: number; order?: string }) =>
    api.get("/leaderboard", LeaderboardPage, params),
};

// ── rooms ─────────────────────────────────────────────────────
const RoomListPage = ManagePageResponse(RoomListResponse);
export const roomService = {
  create: (body: RoomCreateRequest) =>
    api.post("/rooms", RoomDetailResponse, body),
  get: (roomId: string) =>
    api.get(`/rooms/${roomId}`, RoomDetailResponse),
  listPublic: (params?: { skip?: number; top?: number; order?: string }) =>
    api.get("/rooms", RoomListPage, params),
  join: (roomId: string) =>
    api.post(`/rooms/${roomId}/actions/join`, RoomDetailResponse),
  quickMatch: () =>
    api.post("/rooms/actions/quick-match", QuickMatchResponse),
  toggleReady: (roomId: string) =>
    api.post(`/rooms/${roomId}/actions/toggle-ready`, RoomDetailResponse),
  /** Start (or fetch, idempotent) the ONLINE game from a Ready room. */
  startGame: (roomId: string) =>
    api.post(`/rooms/${roomId}/actions/start-game`, GameStartedEvent),
};

// ── games ─────────────────────────────────────────────────────
export const gameService = {
  startLocal: (body: LocalGameCreateRequest) =>
    api.post("/games", GameDetailResponse, body),
  tossCoin: (gameId: string) =>
    api.post(`/games/${gameId}/actions/coin-toss`, CoinTossResponse),
  placeMove: (gameId: string, body: MoveCreateRequest) =>
    api.post(`/games/${gameId}/moves`, GameStateResponse, body),
  placeOpeningStone: (gameId: string, body: OpeningStoneCreateRequest) =>
    api.post(`/games/${gameId}/opening-stones`, GameStateResponse, body),
  undoLastOpeningStone: (gameId: string) =>
    api.post(`/games/${gameId}/opening-stones/actions/undo-last`, GameStateResponse),
  makeSwap2Choice: (gameId: string, body: Swap2ChoiceRequest) =>
    api.post(`/games/${gameId}/actions/swap2-choice`, GameStateResponse, body),
  rematch: (gameId: string) =>
    api.post(`/games/${gameId}/actions/rematch`, GameDetailResponse),
  replay: (gameId: string) =>
    api.get(`/games/${gameId}/replay`, GameReplayResponse),
};
