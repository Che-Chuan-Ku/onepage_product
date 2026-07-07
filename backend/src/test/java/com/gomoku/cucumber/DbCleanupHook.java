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
        // Note: effect_definitions is intentionally NOT truncated — it holds
        // migration-seeded data-driven effect declarations (PVE increment A).
        jdbcTemplate.execute(
                "TRUNCATE TABLE pve_shop_offer_slots, pve_shop_visits, pve_run_relics, "
                        + "pve_run_skills, pve_encounter_events, pve_field_states, "
                        + "pve_field_cells, pve_encounter_moves, pve_encounters, pve_runs, "
                        + "skill_usages, field_events, field_cells, field_states, "
                        + "opening_stones, moves, games, room_chat_messages, "
                        + "room_members, game_rooms, player_stats, players "
                        + "RESTART IDENTITY CASCADE");
    }
}
