/**
 * STOMP destinations — verbatim from api.yml x-stomp-channels.
 * Real-time online play (move broadcast, opening sync, room ready/chat).
 */
export const channels = {
  room: (roomId: string) => `/topic/room/${roomId}`,
  game: (gameId: string) => `/topic/game/${gameId}`,
  gameOpening: (gameId: string) => `/topic/game/${gameId}/opening`,
  /** client -> server move submission (server validates then broadcasts) */
  sendMove: (gameId: string) => `/app/game/${gameId}/move`,
};
