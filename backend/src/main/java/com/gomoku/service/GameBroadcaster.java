package com.gomoku.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Publishes real-time updates over STOMP. Destinations mirror api.yml
 * x-stomp-channels.
 */
@Component
public class GameBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public GameBroadcaster(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /** /topic/room/{roomId} — Ready state + chat broadcast. */
    public void broadcastRoom(String roomId, Object payload) {
        messagingTemplate.convertAndSend("/topic/room/" + roomId, payload);
    }

    /** /topic/game/{gameId} — GameStateUpdated. */
    public void broadcastGameState(String gameId, Object payload) {
        messagingTemplate.convertAndSend("/topic/game/" + gameId, payload);
    }

    /** /topic/game/{gameId}/opening — Swap2 opening sync. */
    public void broadcastOpening(String gameId, Object payload) {
        messagingTemplate.convertAndSend("/topic/game/" + gameId + "/opening", payload);
    }
}
