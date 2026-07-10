-- PVE 魔王對弈與策略引導（documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §5.1 diff 清單）:
--  * pve_encounters gains encounter_type (PUZZLE default / DUEL, sequences 4/8)
--    and opening_script (NONE default / HUAYUE(L4) / PUYUE(L8));
--  * pve_encounter_events gains BOSS_MOVE_PLACED (the boss's reply stone after
--    each player move in a DUEL encounter, §1.5/§5.1).
-- L4/L8 stop being PUZZLE encounters: no PveFieldCell rows are written for
-- them anymore (createEncounter's DUEL branch skips plan().cells(), which is
-- always empty for DUEL plans) — no schema change needed for pve_field_cells.

ALTER TABLE pve_encounters
    ADD COLUMN encounter_type VARCHAR(10) NOT NULL DEFAULT 'PUZZLE';
ALTER TABLE pve_encounters
    ADD CONSTRAINT ck_pve_encounters_encounter_type
        CHECK (encounter_type IN ('PUZZLE', 'DUEL'));

ALTER TABLE pve_encounters
    ADD COLUMN opening_script VARCHAR(10) NOT NULL DEFAULT 'NONE';
ALTER TABLE pve_encounters
    ADD CONSTRAINT ck_pve_encounters_opening_script
        CHECK (opening_script IN ('NONE', 'HUAYUE', 'PUYUE'));

ALTER TABLE pve_encounter_events DROP CONSTRAINT ck_pve_encounter_events_event_type;
ALTER TABLE pve_encounter_events
    ADD CONSTRAINT ck_pve_encounter_events_event_type
        CHECK (event_type IN
            ('LINE_RESOLVED', 'SKILL_USED', 'STONES_PUSHED', 'STONE_REMOVED_OFF_BOARD',
             'VOLCANO_ERUPTED', 'WAVE_SURGED', 'TIDE_TRIGGERED', 'BOSS_MUTATION_TRIGGERED',
             'BOSS_MOVE_PLACED', 'ENCOUNTER_CLEARED', 'ENCOUNTER_FAILED'));
