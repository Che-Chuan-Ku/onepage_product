-- ── PVE challenge mode (documents/PVE-挑戰模式-增量需求.md) — aligns erm.dbml ──
-- Increment A: effect_definitions (data-driven effect declarations, FR-A1/A2).
-- Increment B/C: pve_runs, pve_encounters, pve_encounter_moves, pve_field_cells,
--   pve_field_states, pve_encounter_events, pve_run_skills, pve_run_relics,
--   pve_shop_visits, pve_shop_offer_slots.
-- Additive beyond erm.dbml (documented deviation): pve_runs.gold_earned /
--   pve_runs.gold_spent — FR-C7 requires the run settlement to show gold
--   earned & spent totals, which cannot be derived consistently from
--   encounters/shop rows alone (see Run終止與結算.feature settlement example).

-- ── effect_definitions (FR-A1 FR-A2 FR-A3) ──────────────────────────
CREATE TABLE effect_definitions (
    id               VARCHAR(36)  NOT NULL,
    effect_key       VARCHAR(50)  NOT NULL,
    applicable_mode  VARCHAR(10)  NOT NULL,
    action_type      VARCHAR(20)  NOT NULL,
    usage_limit_type VARCHAR(20)  NOT NULL,
    trigger          VARCHAR(100) NOT NULL,
    condition        TEXT,
    ops              TEXT         NOT NULL,
    params           TEXT,
    created_at       TIMESTAMP    NOT NULL,
    updated_at       TIMESTAMP    NOT NULL,
    version          INT          NOT NULL DEFAULT 0,
    is_deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_effect_definitions PRIMARY KEY (id),
    CONSTRAINT ck_effect_definitions_mode CHECK (applicable_mode IN ('PVP', 'PVE')),
    CONSTRAINT ck_effect_definitions_action CHECK (action_type IN
        ('ATTACHED_TO_MOVE', 'REPLACE_MOVE', 'INDEPENDENT')),
    CONSTRAINT ck_effect_definitions_usage CHECK (usage_limit_type IN
        ('ONCE_PER_GAME', 'CONSUMABLE', 'CHARGE'))
);
CREATE UNIQUE INDEX uk_effect_definitions_key_mode
    ON effect_definitions (effect_key, applicable_mode);

-- Seed: 6 skills + 2 field effects, each declared for PVP and PVE (FR-A1/A2).
-- PVP: normal skills ATTACHED_TO_MOVE, ultimates REPLACE_MOVE, all ONCE_PER_GAME.
-- PVE: everything INDEPENDENT + CONSUMABLE.
INSERT INTO effect_definitions
    (id, effect_key, applicable_mode, action_type, usage_limit_type, trigger, condition, ops, params, created_at, updated_at, version, is_deleted)
VALUES
    (gen_random_uuid()::text, 'HORIZONTAL_SLASH',      'PVP', 'ATTACHED_TO_MOVE', 'ONCE_PER_GAME', 'on_skill_cast', '{"direction":["UP","DOWN"]}',   '["PLACE","PUSH"]',      '{"width":3,"distance":1}', NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'VERTICAL_SLASH',        'PVP', 'ATTACHED_TO_MOVE', 'ONCE_PER_GAME', 'on_skill_cast', '{"direction":["LEFT","RIGHT"]}','["PLACE","PUSH"]',      '{"width":1,"distance":1}', NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'HEAVEN_EARTH_REVERSAL', 'PVP', 'REPLACE_MOVE',     'ONCE_PER_GAME', 'on_skill_cast', '{"anchorMustBeEmpty":true}',    '["TRANSFORM"]',         '{"zone":"3x2"}',           NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'PRECISION_SNIPE',       'PVP', 'ATTACHED_TO_MOVE', 'ONCE_PER_GAME', 'on_skill_cast', '{"targetMustBeEnemyStone":true}','["REMOVE","PLACE"]',   NULL,                       NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'SCATTER_SHOT',          'PVP', 'ATTACHED_TO_MOVE', 'ONCE_PER_GAME', 'on_skill_cast', '{"minChebyshev":2}',            '["PLACE","PLACE"]',     NULL,                       NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'PIONEER_STAR',          'PVP', 'REPLACE_MOVE',     'ONCE_PER_GAME', 'on_skill_cast', '{"anchorMustBeEmpty":true}',    '["REMOVE"]',            '{"zone":"3x2"}',           NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'VOLCANO_ERUPTED',       'PVP', 'INDEPENDENT',      'ONCE_PER_GAME', 'on_move_placed', '{"hiddenCell":"ERUPTION"}',    '["REMOVE"]',            '{"radius":1}',             NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'WAVE_SURGED',           'PVP', 'INDEPENDENT',      'ONCE_PER_GAME', 'on_move_interval', '{"everyHands":10}',          '["PUSH"]',              '{"distance":1}',           NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'HORIZONTAL_SLASH',      'PVE', 'INDEPENDENT', 'CONSUMABLE', 'on_skill_cast', '{"direction":["UP","DOWN"]}',    '["PUSH"]',              '{"width":3,"distance":1}', NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'VERTICAL_SLASH',        'PVE', 'INDEPENDENT', 'CONSUMABLE', 'on_skill_cast', '{"direction":["LEFT","RIGHT"]}', '["PUSH"]',              '{"width":1,"distance":1}', NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'HEAVEN_EARTH_REVERSAL', 'PVE', 'INDEPENDENT', 'CONSUMABLE', 'on_skill_cast', '{"anchorMustBeEmpty":true}',     '["TRANSFORM"]',         '{"zone":"3x2"}',           NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'PRECISION_SNIPE',       'PVE', 'INDEPENDENT', 'CONSUMABLE', 'on_skill_cast', '{"targetMustBeEnemyStone":true}','["REMOVE","PLACE"]',    NULL,                       NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'SCATTER_SHOT',          'PVE', 'INDEPENDENT', 'CONSUMABLE', 'on_skill_cast', '{"minChebyshev":2}',             '["PLACE","PLACE"]',     NULL,                       NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'PIONEER_STAR',          'PVE', 'INDEPENDENT', 'CONSUMABLE', 'on_skill_cast', '{"anchorMustBeEmpty":true}',     '["REMOVE"]',            '{"zone":"3x2"}',           NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'VOLCANO_ERUPTED',       'PVE', 'INDEPENDENT', 'CONSUMABLE', 'on_move_placed', '{"hiddenCell":"ERUPTION"}',     '["REMOVE"]',            '{"radius":1}',             NOW(), NOW(), 0, FALSE),
    (gen_random_uuid()::text, 'WAVE_SURGED',           'PVE', 'INDEPENDENT', 'CONSUMABLE', 'on_move_interval', '{"everyHands":10}',           '["PUSH"]',              '{"distance":1}',           NOW(), NOW(), 0, FALSE);

-- ── pve_runs (FR-C1 FR-C3 FR-C7 FR-C8) ──────────────────────────────
CREATE TABLE pve_runs (
    id                          VARCHAR(36)   NOT NULL,
    player_id                   VARCHAR(36)   NOT NULL,
    class_type                  VARCHAR(20)   NOT NULL,
    status                      VARCHAR(20)   NOT NULL DEFAULT 'IN_PROGRESS',
    seed                        VARCHAR(64)   NOT NULL,
    gold                        INT           NOT NULL DEFAULT 0,
    current_encounter_sequence  INT           NOT NULL DEFAULT 1,
    reached_encounter_sequence  INT           NOT NULL DEFAULT 0,
    total_damage_dealt          BIGINT        NOT NULL DEFAULT 0,
    metronome_multiplier_bonus  DECIMAL(6,2)  NOT NULL DEFAULT 0,
    gold_earned                 INT           NOT NULL DEFAULT 0,
    gold_spent                  INT           NOT NULL DEFAULT 0,
    ended_at                    TIMESTAMP,
    created_at                  TIMESTAMP     NOT NULL,
    updated_at                  TIMESTAMP     NOT NULL,
    version                     INT           NOT NULL DEFAULT 0,
    is_deleted                  BOOLEAN       NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_pve_runs PRIMARY KEY (id),
    CONSTRAINT ck_pve_runs_class_type CHECK (class_type IN ('WARRIOR', 'ARCHER')),
    CONSTRAINT ck_pve_runs_status CHECK (status IN ('IN_PROGRESS', 'WON', 'LOST', 'ABANDONED')),
    CONSTRAINT fk_pve_runs_player FOREIGN KEY (player_id) REFERENCES players (id)
);
CREATE INDEX idx_pve_runs_player_status ON pve_runs (player_id, status);

-- ── pve_encounters (FR-B1 FR-C1 FR-C2) ──────────────────────────────
CREATE TABLE pve_encounters (
    id              VARCHAR(36) NOT NULL,
    run_id          VARCHAR(36) NOT NULL,
    sequence        INT         NOT NULL,
    field_type      VARCHAR(20) NOT NULL,
    mutation_type   VARCHAR(20) NOT NULL DEFAULT 'NONE',
    board_rows      INT         NOT NULL DEFAULT 11,
    board_cols      INT         NOT NULL DEFAULT 11,
    boss_hp_max     INT         NOT NULL,
    boss_hp_current INT         NOT NULL,
    move_budget     INT         NOT NULL DEFAULT 30,
    moves_used      INT         NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    cleared_at      TIMESTAMP,
    failed_at       TIMESTAMP,
    created_at      TIMESTAMP   NOT NULL,
    updated_at      TIMESTAMP   NOT NULL,
    version         INT         NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_pve_encounters PRIMARY KEY (id),
    CONSTRAINT ck_pve_encounters_field_type CHECK (field_type IN ('PLAIN', 'VOLCANO', 'BEACH')),
    CONSTRAINT ck_pve_encounters_mutation CHECK (mutation_type IN ('NONE', 'ONE_EYE', 'RAGE', 'ABYSS')),
    CONSTRAINT ck_pve_encounters_status CHECK (status IN ('IN_PROGRESS', 'CLEARED', 'FAILED')),
    CONSTRAINT fk_pve_encounters_run FOREIGN KEY (run_id) REFERENCES pve_runs (id)
);
CREATE UNIQUE INDEX uk_pve_encounters_run_sequence ON pve_encounters (run_id, sequence);

-- ── pve_encounter_moves (FR-B2 FR-B6, immutable event stream) ───────
CREATE TABLE pve_encounter_moves (
    id                     VARCHAR(36) NOT NULL,
    encounter_id           VARCHAR(36) NOT NULL,
    encounter_move_number  INT         NOT NULL,
    run_move_number        INT         NOT NULL,
    "row"                  INT         NOT NULL,
    "col"                  INT         NOT NULL,
    placed_at              TIMESTAMP   NOT NULL,
    CONSTRAINT pk_pve_encounter_moves PRIMARY KEY (id),
    CONSTRAINT fk_pve_encounter_moves_encounter FOREIGN KEY (encounter_id) REFERENCES pve_encounters (id)
);
CREATE UNIQUE INDEX uk_pve_encounter_moves_encounter_seq
    ON pve_encounter_moves (encounter_id, encounter_move_number);

-- ── pve_field_cells (FR-C2, generation-time cells) ──────────────────
CREATE TABLE pve_field_cells (
    id                VARCHAR(36) NOT NULL,
    encounter_id      VARCHAR(36) NOT NULL,
    cell_kind         VARCHAR(20) NOT NULL,
    "row"             INT         NOT NULL,
    "col"             INT         NOT NULL,
    visible_to_player BOOLEAN     NOT NULL DEFAULT FALSE,
    triggered         BOOLEAN     NOT NULL DEFAULT FALSE,
    triggered_at      TIMESTAMP,
    created_at        TIMESTAMP   NOT NULL,
    updated_at        TIMESTAMP   NOT NULL,
    version           INT         NOT NULL DEFAULT 0,
    is_deleted        BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_pve_field_cells PRIMARY KEY (id),
    CONSTRAINT ck_pve_field_cells_cell_kind CHECK (cell_kind IN ('OBSTACLE', 'ERUPTION', 'TIDE')),
    CONSTRAINT fk_pve_field_cells_encounter FOREIGN KEY (encounter_id) REFERENCES pve_encounters (id)
);
CREATE UNIQUE INDEX uk_pve_field_cells_encounter_position
    ON pve_field_cells (encounter_id, "row", "col");

-- ── pve_field_states (FR-C2) ────────────────────────────────────────
CREATE TABLE pve_field_states (
    id                 VARCHAR(36) NOT NULL,
    encounter_id       VARCHAR(36) NOT NULL,
    sea_side           VARCHAR(10),
    eroded_rows        INT         NOT NULL DEFAULT 0,
    tide_triggered     BOOLEAN     NOT NULL DEFAULT FALSE,
    wave_move_counter  INT         NOT NULL DEFAULT 0,
    created_at         TIMESTAMP   NOT NULL,
    updated_at         TIMESTAMP   NOT NULL,
    version            INT         NOT NULL DEFAULT 0,
    is_deleted         BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_pve_field_states PRIMARY KEY (id),
    CONSTRAINT ck_pve_field_states_sea_side CHECK (sea_side IS NULL OR sea_side IN ('NORTH', 'SOUTH', 'EAST', 'WEST')),
    CONSTRAINT fk_pve_field_states_encounter FOREIGN KEY (encounter_id) REFERENCES pve_encounters (id)
);
CREATE UNIQUE INDEX uk_pve_field_states_encounter_id ON pve_field_states (encounter_id);

-- ── pve_encounter_events (FR-B2/B3/B5/C6, immutable event stream) ───
CREATE TABLE pve_encounter_events (
    id           VARCHAR(36) NOT NULL,
    encounter_id VARCHAR(36) NOT NULL,
    move_number  INT,
    event_type   VARCHAR(30) NOT NULL,
    "row"        INT,
    "col"        INT,
    detail       TEXT,
    occurred_at  TIMESTAMP   NOT NULL,
    CONSTRAINT pk_pve_encounter_events PRIMARY KEY (id),
    CONSTRAINT ck_pve_encounter_events_event_type CHECK (event_type IN
        ('LINE_RESOLVED', 'SKILL_USED', 'STONES_PUSHED', 'STONE_REMOVED_OFF_BOARD',
         'VOLCANO_ERUPTED', 'WAVE_SURGED', 'TIDE_TRIGGERED', 'BOSS_MUTATION_TRIGGERED',
         'ENCOUNTER_CLEARED', 'ENCOUNTER_FAILED')),
    CONSTRAINT fk_pve_encounter_events_encounter FOREIGN KEY (encounter_id) REFERENCES pve_encounters (id)
);
CREATE INDEX idx_pve_encounter_events_encounter_move
    ON pve_encounter_events (encounter_id, move_number);

-- ── pve_run_skills (FR-B5 FR-C4) ────────────────────────────────────
CREATE TABLE pve_run_skills (
    id         VARCHAR(36) NOT NULL,
    run_id     VARCHAR(36) NOT NULL,
    skill_type VARCHAR(30) NOT NULL,
    quantity   INT         NOT NULL DEFAULT 1,
    created_at TIMESTAMP   NOT NULL,
    updated_at TIMESTAMP   NOT NULL,
    version    INT         NOT NULL DEFAULT 0,
    is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_pve_run_skills PRIMARY KEY (id),
    CONSTRAINT ck_pve_run_skills_skill_type CHECK (skill_type IN
        ('HORIZONTAL_SLASH', 'VERTICAL_SLASH', 'HEAVEN_EARTH_REVERSAL',
         'PRECISION_SNIPE', 'SCATTER_SHOT', 'PIONEER_STAR')),
    CONSTRAINT fk_pve_run_skills_run FOREIGN KEY (run_id) REFERENCES pve_runs (id)
);
CREATE UNIQUE INDEX uk_pve_run_skills_run_skill ON pve_run_skills (run_id, skill_type);

-- ── pve_run_relics (FR-C4 FR-C5) ────────────────────────────────────
CREATE TABLE pve_run_relics (
    id          VARCHAR(36) NOT NULL,
    run_id      VARCHAR(36) NOT NULL,
    relic_type  VARCHAR(30) NOT NULL,
    acquired_at TIMESTAMP   NOT NULL,
    created_at  TIMESTAMP   NOT NULL,
    updated_at  TIMESTAMP   NOT NULL,
    version     INT         NOT NULL DEFAULT 0,
    is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_pve_run_relics PRIMARY KEY (id),
    CONSTRAINT ck_pve_run_relics_relic_type CHECK (relic_type IN
        ('SHARP_BLADE', 'CHAIN_CORE', 'DIAGONAL_WALKER', 'VOLCANO_HEART',
         'TIDE_BREAKWATER', 'METRONOME', 'RECYCLER', 'GEMINI_STAR')),
    CONSTRAINT fk_pve_run_relics_run FOREIGN KEY (run_id) REFERENCES pve_runs (id)
);
CREATE UNIQUE INDEX uk_pve_run_relics_run_relic ON pve_run_relics (run_id, relic_type);

-- ── pve_shop_visits (FR-C4) ─────────────────────────────────────────
CREATE TABLE pve_shop_visits (
    id                       VARCHAR(36) NOT NULL,
    run_id                   VARCHAR(36) NOT NULL,
    after_encounter_sequence INT         NOT NULL,
    status                   VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    reroll_count             INT         NOT NULL DEFAULT 0,
    opened_at                TIMESTAMP   NOT NULL,
    closed_at                TIMESTAMP,
    created_at               TIMESTAMP   NOT NULL,
    updated_at               TIMESTAMP   NOT NULL,
    version                  INT         NOT NULL DEFAULT 0,
    is_deleted               BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_pve_shop_visits PRIMARY KEY (id),
    CONSTRAINT ck_pve_shop_visits_status CHECK (status IN ('OPEN', 'CLOSED')),
    CONSTRAINT fk_pve_shop_visits_run FOREIGN KEY (run_id) REFERENCES pve_runs (id)
);
CREATE UNIQUE INDEX uk_pve_shop_visits_run_sequence
    ON pve_shop_visits (run_id, after_encounter_sequence);

-- ── pve_shop_offer_slots (FR-C4 FR-C5) ──────────────────────────────
CREATE TABLE pve_shop_offer_slots (
    id            VARCHAR(36) NOT NULL,
    shop_visit_id VARCHAR(36) NOT NULL,
    slot_index    INT         NOT NULL,
    offer_kind    VARCHAR(10) NOT NULL,
    relic_type    VARCHAR(30),
    skill_type    VARCHAR(30),
    price         INT         NOT NULL,
    purchased     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP   NOT NULL,
    updated_at    TIMESTAMP   NOT NULL,
    version       INT         NOT NULL DEFAULT 0,
    is_deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_pve_shop_offer_slots PRIMARY KEY (id),
    CONSTRAINT ck_pve_shop_offer_slots_kind CHECK (offer_kind IN ('RELIC', 'SKILL')),
    CONSTRAINT fk_pve_shop_offer_slots_visit FOREIGN KEY (shop_visit_id) REFERENCES pve_shop_visits (id)
);
CREATE UNIQUE INDEX uk_pve_shop_offer_slots_visit_slot
    ON pve_shop_offer_slots (shop_visit_id, slot_index);
