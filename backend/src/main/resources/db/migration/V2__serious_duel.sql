-- ── Serious Duel mode (真劍勝負, req #34–#47) — aligns erm.dbml ─────────
-- Adds battle_mode / field_type / class columns and the four new tables:
-- skill_usages, field_cells, field_states, field_events.

-- ── game_rooms: battle mode + field type (req #34) ──────────────────
ALTER TABLE game_rooms
    ADD COLUMN battle_mode VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN field_type  VARCHAR(20);
ALTER TABLE game_rooms
    ADD CONSTRAINT ck_game_rooms_battle_mode CHECK (battle_mode IN ('NORMAL', 'SERIOUS_DUEL')),
    ADD CONSTRAINT ck_game_rooms_field_type CHECK (field_type IS NULL OR field_type IN ('VOLCANO', 'BEACH'));

-- ── room_members: class selection (req #35) ─────────────────────────
ALTER TABLE room_members
    ADD COLUMN class_type VARCHAR(20);
ALTER TABLE room_members
    ADD CONSTRAINT ck_room_members_class_type CHECK (class_type IS NULL OR class_type IN ('WARRIOR', 'ARCHER'));

-- ── games: mode snapshot + revealed classes (req #34 #35) ───────────
ALTER TABLE games
    ADD COLUMN battle_mode VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN field_type  VARCHAR(20),
    ADD COLUMN black_class VARCHAR(20),
    ADD COLUMN white_class VARCHAR(20);
ALTER TABLE games
    ADD CONSTRAINT ck_games_battle_mode CHECK (battle_mode IN ('NORMAL', 'SERIOUS_DUEL')),
    ADD CONSTRAINT ck_games_field_type CHECK (field_type IS NULL OR field_type IN ('VOLCANO', 'BEACH')),
    ADD CONSTRAINT ck_games_black_class CHECK (black_class IS NULL OR black_class IN ('WARRIOR', 'ARCHER')),
    ADD CONSTRAINT ck_games_white_class CHECK (white_class IS NULL OR white_class IN ('WARRIOR', 'ARCHER'));

-- ── moves: drop position uniqueness ─────────────────────────────────
-- Serious Duel effects (eruption burn, pushes, pioneer star) free cells that
-- can legally be played again, so the immutable move stream may contain the
-- same (game_id,row,col) more than once. Cell occupancy is enforced by the
-- server-authoritative board reconstruction instead (normal mode behaviour
-- is unchanged: its occupancy check still rejects duplicates before insert).
DROP INDEX uk_moves_game_position;

-- ── skill_usages (req #36 #42 #43): one use per skill per player ────
CREATE TABLE skill_usages (
    id          VARCHAR(36) NOT NULL,
    game_id     VARCHAR(36) NOT NULL,
    player_id   VARCHAR(36) NOT NULL,
    skill_type  VARCHAR(30) NOT NULL,
    move_number INT,
    used_at     TIMESTAMP   NOT NULL,
    CONSTRAINT pk_skill_usages PRIMARY KEY (id),
    CONSTRAINT ck_skill_usages_skill_type CHECK (skill_type IN
        ('HORIZONTAL_SLASH', 'VERTICAL_SLASH', 'HEAVEN_EARTH_REVERSAL',
         'PRECISION_SNIPE', 'SCATTER_SHOT', 'PIONEER_STAR')),
    CONSTRAINT fk_skill_usages_game FOREIGN KEY (game_id) REFERENCES games (id),
    CONSTRAINT fk_skill_usages_player FOREIGN KEY (player_id) REFERENCES players (id)
);
CREATE UNIQUE INDEX uk_skill_usages_game_player_skill ON skill_usages (game_id, player_id, skill_type);

-- ── field_cells (req #39 #40 #44): obstacles + hidden cells ─────────
CREATE TABLE field_cells (
    id                 VARCHAR(36) NOT NULL,
    game_id            VARCHAR(36) NOT NULL,
    cell_kind          VARCHAR(20) NOT NULL,
    "row"              INT         NOT NULL,
    "col"              INT         NOT NULL,
    visible_to_players BOOLEAN     NOT NULL DEFAULT FALSE,
    triggered          BOOLEAN     NOT NULL DEFAULT FALSE,
    triggered_at       TIMESTAMP,
    created_at         TIMESTAMP   NOT NULL,
    updated_at         TIMESTAMP   NOT NULL,
    version            INT         NOT NULL DEFAULT 0,
    is_deleted         BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_field_cells PRIMARY KEY (id),
    CONSTRAINT ck_field_cells_cell_kind CHECK (cell_kind IN ('OBSTACLE', 'ERUPTION', 'TIDE')),
    CONSTRAINT fk_field_cells_game FOREIGN KEY (game_id) REFERENCES games (id)
);
CREATE UNIQUE INDEX uk_field_cells_game_position ON field_cells (game_id, "row", "col");
CREATE INDEX idx_field_cells_game_kind ON field_cells (game_id, cell_kind);

-- ── field_states (req #40 #41 #46): one row per serious-duel game ───
CREATE TABLE field_states (
    id             VARCHAR(36) NOT NULL,
    game_id        VARCHAR(36) NOT NULL,
    field_type     VARCHAR(20) NOT NULL,
    sea_side       VARCHAR(10),
    eroded_rows    INT         NOT NULL DEFAULT 0,
    tide_triggered BOOLEAN     NOT NULL DEFAULT FALSE,
    round_counter  INT         NOT NULL DEFAULT 0,
    created_at     TIMESTAMP   NOT NULL,
    updated_at     TIMESTAMP   NOT NULL,
    version        INT         NOT NULL DEFAULT 0,
    is_deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_field_states PRIMARY KEY (id),
    CONSTRAINT ck_field_states_field_type CHECK (field_type IN ('VOLCANO', 'BEACH')),
    CONSTRAINT ck_field_states_sea_side CHECK (sea_side IS NULL OR sea_side IN ('NORTH', 'SOUTH', 'EAST', 'WEST')),
    CONSTRAINT fk_field_states_game FOREIGN KEY (game_id) REFERENCES games (id)
);
CREATE UNIQUE INDEX uk_field_states_game_id ON field_states (game_id);

-- ── field_events (req #37 #38 #47): immutable effect event stream ───
CREATE TABLE field_events (
    id          VARCHAR(36) NOT NULL,
    game_id     VARCHAR(36) NOT NULL,
    move_number INT,
    event_type  VARCHAR(30) NOT NULL,
    "row"       INT,
    "col"       INT,
    detail      TEXT,
    occurred_at TIMESTAMP   NOT NULL,
    CONSTRAINT pk_field_events PRIMARY KEY (id),
    CONSTRAINT ck_field_events_event_type CHECK (event_type IN
        ('FIELD_GENERATED', 'STONE_PUSHED', 'STONE_REMOVED_OFF_BOARD', 'STONES_BURNED',
         'STONE_REPLACED', 'STONES_CLEARED', 'COLORS_SWAPPED', 'VOLCANO_ERUPTED',
         'WAVE_SURGED', 'TIDE_TRIGGERED', 'TIDE_RISEN', 'SAND_ERODED')),
    CONSTRAINT fk_field_events_game FOREIGN KEY (game_id) REFERENCES games (id)
);
CREATE INDEX idx_field_events_game_move ON field_events (game_id, move_number);
