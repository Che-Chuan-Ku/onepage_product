-- PVE 魔王對弈公平性修正（documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §1.5/§6.5,
-- 2026-07-09）：
--  * pve_encounters.status gains DRAW — DUEL-only: move budget exhausted with
--    NEITHER side completing a five-in-a-row. Distinct from FAILED: the run
--    is NOT forfeited (stays IN_PROGRESS), the encounter is retryable in
--    place (retryDuelEncounter) — an unlimited number of times.
--  * pve_encounters gains drawn_at (mirrors cleared_at/failed_at) and
--    attempt_number (1-based retry ordinal, mixed into the boss-AI RNG seed
--    on each retry so a re-attempt is NOT a deterministic replay of the same
--    draw).
--  * A DRAW retry soft-deletes the old encounter row and inserts a FRESH one
--    for the same (run_id, sequence) — the old unique index enforced
--    uniqueness across ALL rows regardless of is_deleted, which would reject
--    that insert; replaced with a partial unique index that only constrains
--    the live (is_deleted = false) rows, consistent with how every other
--    soft-deleted table in this schema is queried
--    (*AndDeletedFalse repository methods).
--  * pve_encounter_events gains ENCOUNTER_DRAWN (the DRAW-ending event,
--    parallel to ENCOUNTER_CLEARED/ENCOUNTER_FAILED).

ALTER TABLE pve_encounters DROP CONSTRAINT ck_pve_encounters_status;
ALTER TABLE pve_encounters
    ADD CONSTRAINT ck_pve_encounters_status
        CHECK (status IN ('IN_PROGRESS', 'CLEARED', 'FAILED', 'DRAW'));

ALTER TABLE pve_encounters
    ADD COLUMN drawn_at TIMESTAMP;
ALTER TABLE pve_encounters
    ADD COLUMN attempt_number INT NOT NULL DEFAULT 1;

DROP INDEX uk_pve_encounters_run_sequence;
CREATE UNIQUE INDEX uk_pve_encounters_run_sequence
    ON pve_encounters (run_id, sequence)
    WHERE is_deleted = false;

ALTER TABLE pve_encounter_events DROP CONSTRAINT ck_pve_encounter_events_event_type;
ALTER TABLE pve_encounter_events
    ADD CONSTRAINT ck_pve_encounter_events_event_type
        CHECK (event_type IN
            ('LINE_RESOLVED', 'SKILL_USED', 'STONES_PUSHED', 'STONE_REMOVED_OFF_BOARD',
             'VOLCANO_ERUPTED', 'WAVE_SURGED', 'TIDE_TRIGGERED', 'BOSS_MUTATION_TRIGGERED',
             'BOSS_MOVE_PLACED', 'ENCOUNTER_CLEARED', 'ENCOUNTER_FAILED', 'ENCOUNTER_DRAWN'));
