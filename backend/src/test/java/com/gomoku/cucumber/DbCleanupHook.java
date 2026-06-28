package com.gomoku.cucumber;

import io.cucumber.java.Before;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Scenario isolation: the suite originally relied on jdbc:tc: giving a fresh
 * DB per context, but scenarios within one run still share state. Truncate
 * all business tables before each scenario so Backgrounds re-seed cleanly.
 */
public class DbCleanupHook {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Before(order = 0)
    public void cleanDatabase() {
        jdbcTemplate.execute(
                "TRUNCATE TABLE opening_stones, moves, games, room_chat_messages, "
                        + "room_members, game_rooms, player_stats, players "
                        + "RESTART IDENTITY CASCADE");
    }
}
