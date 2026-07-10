-- PVE 關卡重設計（documents/PVE-關卡重設計-2026-07-08.md §6 diff 清單）:
--  * pve_field_cells.cell_kind gains INITIAL_BLACK (pre-placed player stone
--    shapes baked into each encounter's starting board);
--  * pve_encounters gains minor_disruption_type + minor_disruption_triggered
--    (single-shot PULSE_CLEAR/PULSE_PUSH variety on sequences 1/2/4/5/7).
-- BOSS_HP_CURVE / MOVE_BUDGET_CURVE themselves are pure Java constants
-- (PveFieldScheduler), not persisted — no column change needed for those.

ALTER TABLE pve_field_cells DROP CONSTRAINT ck_pve_field_cells_cell_kind;
ALTER TABLE pve_field_cells
    ADD CONSTRAINT ck_pve_field_cells_cell_kind
        CHECK (cell_kind IN ('OBSTACLE', 'ERUPTION', 'TIDE', 'INITIAL_BLACK'));

ALTER TABLE pve_encounters
    ADD COLUMN minor_disruption_type VARCHAR(20) NOT NULL DEFAULT 'NONE';
ALTER TABLE pve_encounters
    ADD CONSTRAINT ck_pve_encounters_minor_disruption
        CHECK (minor_disruption_type IN ('NONE', 'PULSE_CLEAR', 'PULSE_PUSH'));
ALTER TABLE pve_encounters
    ADD COLUMN minor_disruption_triggered BOOLEAN NOT NULL DEFAULT FALSE;
