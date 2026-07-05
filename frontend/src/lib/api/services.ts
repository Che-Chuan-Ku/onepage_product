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
  RoomCreateRequestInput,
  SelectClassRequest,
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
  // Input type: battleMode defaults to NORMAL, so pre-duel call sites
  // (visibility + isSwap2Mode only) keep compiling unchanged.
  create: (body: RoomCreateRequestInput) =>
    api.post("/rooms", RoomDetailResponse, body),
  /** 真劍勝負職業選擇（operationId: selectClass, api.yml:310-352）. */
  selectClass: (roomId: string, body: SelectClassRequest) =>
    api.post(`/rooms/${roomId}/actions/select-class`, RoomDetailResponse, body),
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
  /** GET /games/{gameId} — authoritative current state incl. `stones` full-board
   * snapshot (bug fix: used to rebuild the Serious Duel board without relying
   * on the client-side event replay, which disagrees with the backend's
   * per-event row/col semantics — see GameStateResponse.stones doc). */
  getState: (gameId: string) => api.get(`/games/${gameId}`, GameStateResponse),
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
