-- ── Gomoku initial schema (aligns erm.dbml; 8 tables) ──────────────
-- Enum columns persisted as VARCHAR (Hibernate EnumType.STRING) with CHECK
-- constraints; soft delete via is_deleted on mutable tables. moves /
-- opening_stones are immutable event streams (no audit columns).

-- ── players ────────────────────────────────────────────────────────
CREATE TABLE players (
    id            VARCHAR(36)  NOT NULL,
    player_type   VARCHAR(20)  NOT NULL,
    username      VARCHAR(50),
    email         VARCHAR(255),
    password_hash VARCHAR(255),
    nickname      VARCHAR(50),
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    version       INT          NOT NULL DEFAULT 0,
    is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_players PRIMARY KEY (id),
    CONSTRAINT ck_players_player_type CHECK (player_type IN ('REGISTERED', 'GUEST'))
);
CREATE UNIQUE INDEX uk_players_username ON players (username);
CREATE UNIQUE INDEX uk_players_email ON players (email);

-- ── player_stats ───────────────────────────────────────────────────
CREATE TABLE player_stats (
    id         VARCHAR(36)   NOT NULL,
    player_id  VARCHAR(36)   NOT NULL,
    wins       INT           NOT NULL DEFAULT 0,
    losses     INT           NOT NULL DEFAULT 0,
    draws      INT           NOT NULL DEFAULT 0,
    win_rate   DECIMAL(19,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP     NOT NULL,
    updated_at TIMESTAMP     NOT NULL,
    version    INT           NOT NULL DEFAULT 0,
    is_deleted BOOLEAN       NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_player_stats PRIMARY KEY (id),
    CONSTRAINT fk_player_stats_player FOREIGN KEY (player_id) REFERENCES players (id)
);
CREATE UNIQUE INDEX uk_player_stats_player_id ON player_stats (player_id);
-- leaderboard: primary key wins DESC, secondary win_rate DESC (Q2)
CREATE INDEX idx_player_stats_leaderboard ON player_stats (wins, win_rate);

-- ── game_rooms ──────────────────────────────────────────────────────
CREATE TABLE game_rooms (
    id              VARCHAR(36) NOT NULL,
    room_code       VARCHAR(12) NOT NULL,
    visibility      VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    is_swap2_mode   BOOLEAN     NOT NULL DEFAULT FALSE,
    host_player_id  VARCHAR(36) NOT NULL,
    guest_player_id VARCHAR(36),
    created_at      TIMESTAMP   NOT NULL,
    updated_at      TIMESTAMP   NOT NULL,
    version         INT         NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_game_rooms PRIMARY KEY (id),
    CONSTRAINT ck_game_rooms_visibility CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    CONSTRAINT ck_game_rooms_status CHECK (status IN ('WAITING', 'READY', 'IN_PROGRESS', 'FINISHED')),
    CONSTRAINT fk_game_rooms_host FOREIGN KEY (host_player_id) REFERENCES players (id),
    CONSTRAINT fk_game_rooms_guest FOREIGN KEY (guest_player_id) REFERENCES players (id)
);
CREATE UNIQUE INDEX uk_game_rooms_room_code ON game_rooms (room_code);
CREATE INDEX idx_game_rooms_visibility_status ON game_rooms (visibility, status);

-- ── room_members ────────────────────────────────────────────────────
CREATE TABLE room_members (
    id         VARCHAR(36) NOT NULL,
    room_id    VARCHAR(36) NOT NULL,
    player_id  VARCHAR(36) NOT NULL,
    role       VARCHAR(20) NOT NULL DEFAULT 'PLAYER',
    is_ready   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP   NOT NULL,
    updated_at TIMESTAMP   NOT NULL,
    version    INT         NOT NULL DEFAULT 0,
    is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_room_members PRIMARY KEY (id),
    CONSTRAINT ck_room_members_role CHECK (role IN ('PLAYER', 'SPECTATOR')),
    CONSTRAINT fk_room_members_room FOREIGN KEY (room_id) REFERENCES game_rooms (id),
    CONSTRAINT fk_room_members_player FOREIGN KEY (player_id) REFERENCES players (id)
);
CREATE UNIQUE INDEX uk_room_members_room_player ON room_members (room_id, player_id);
CREATE INDEX idx_room_members_room_role ON room_members (room_id, role);

-- ── room_chat_messages ──────────────────────────────────────────────
CREATE TABLE room_chat_messages (
    id         VARCHAR(36)  NOT NULL,
    room_id    VARCHAR(36)  NOT NULL,
    player_id  VARCHAR(36)  NOT NULL,
    content    VARCHAR(500) NOT NULL,
    created_at TIMESTAMP    NOT NULL,
    updated_at TIMESTAMP    NOT NULL,
    version    INT          NOT NULL DEFAULT 0,
    is_deleted BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_room_chat_messages PRIMARY KEY (id),
    CONSTRAINT fk_room_chat_room FOREIGN KEY (room_id) REFERENCES game_rooms (id),
    CONSTRAINT fk_room_chat_player FOREIGN KEY (player_id) REFERENCES players (id)
);
CREATE INDEX idx_room_chat_messages_room_id ON room_chat_messages (room_id);

-- ── games ───────────────────────────────────────────────────────────
CREATE TABLE games (
    id                        VARCHAR(36) NOT NULL,
    room_id                   VARCHAR(36),
    game_mode                 VARCHAR(20) NOT NULL,
    opening_type              VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    use_swap2                 BOOLEAN     NOT NULL DEFAULT FALSE,
    swap2_two_more_chosen     BOOLEAN     NOT NULL DEFAULT FALSE,  -- Swap2: PLACE_TWO_MORE chosen (state-machine input)
    status                    VARCHAR(20) NOT NULL DEFAULT 'PLAYING',
    black_player_id           VARCHAR(36),
    white_player_id           VARCHAR(36),
    tentative_first_player_id VARCHAR(36),
    coin_result               VARCHAR(10),
    current_turn              VARCHAR(10),
    result                    VARCHAR(20),
    winner_player_id          VARCHAR(36),
    move_count                INT         NOT NULL DEFAULT 0,
    duration_seconds          INT,
    ended_at                  TIMESTAMP,
    created_at                TIMESTAMP   NOT NULL,
    updated_at                TIMESTAMP   NOT NULL,
    version                   INT         NOT NULL DEFAULT 0,
    is_deleted                BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_games PRIMARY KEY (id),
    CONSTRAINT ck_games_game_mode CHECK (game_mode IN ('LOCAL', 'ONLINE')),
    CONSTRAINT ck_games_opening_type CHECK (opening_type IN ('STANDARD', 'SWAP2')),
    CONSTRAINT ck_games_status CHECK (status IN ('OPENING', 'PLAYING', 'FINISHED')),
    CONSTRAINT ck_games_coin_result CHECK (coin_result IS NULL OR coin_result IN ('HEADS', 'TAILS')),
    CONSTRAINT ck_games_current_turn CHECK (current_turn IS NULL OR current_turn IN ('BLACK', 'WHITE')),
    CONSTRAINT ck_games_result CHECK (result IS NULL OR result IN ('BLACK_WIN', 'WHITE_WIN', 'DRAW')),
    CONSTRAINT fk_games_room FOREIGN KEY (room_id) REFERENCES game_rooms (id),
    CONSTRAINT fk_games_black FOREIGN KEY (black_player_id) REFERENCES players (id),
    CONSTRAINT fk_games_white FOREIGN KEY (white_player_id) REFERENCES players (id),
    CONSTRAINT fk_games_tentative FOREIGN KEY (tentative_first_player_id) REFERENCES players (id),
    CONSTRAINT fk_games_winner FOREIGN KEY (winner_player_id) REFERENCES players (id)
);
CREATE INDEX idx_games_room_id ON games (room_id);
CREATE INDEX idx_games_winner_player_id ON games (winner_player_id);

-- ── moves (immutable event stream) ──────────────────────────────────
CREATE TABLE moves (
    id          VARCHAR(36) NOT NULL,
    game_id     VARCHAR(36) NOT NULL,
    move_number INT         NOT NULL,
    color       VARCHAR(10) NOT NULL,
    "row"       INT         NOT NULL,
    "col"       INT         NOT NULL,
    placed_at   TIMESTAMP   NOT NULL,
    CONSTRAINT pk_moves PRIMARY KEY (id),
    CONSTRAINT ck_moves_color CHECK (color IN ('BLACK', 'WHITE')),
    CONSTRAINT fk_moves_game FOREIGN KEY (game_id) REFERENCES games (id)
);
CREATE UNIQUE INDEX uk_moves_game_move_number ON moves (game_id, move_number);
CREATE UNIQUE INDEX uk_moves_game_position ON moves (game_id, "row", "col");

-- ── opening_stones (Swap2 event stream) ─────────────────────────────
CREATE TABLE opening_stones (
    id                   VARCHAR(36) NOT NULL,
    game_id              VARCHAR(36) NOT NULL,
    sequence             INT         NOT NULL,
    color                VARCHAR(10) NOT NULL,
    "row"                INT         NOT NULL,
    "col"                INT         NOT NULL,
    placed_by_player_id  VARCHAR(36),  -- nullable: LOCAL games have no player id
    placed_at            TIMESTAMP   NOT NULL,
    CONSTRAINT pk_opening_stones PRIMARY KEY (id),
    CONSTRAINT ck_opening_stones_color CHECK (color IN ('BLACK', 'WHITE')),
    CONSTRAINT fk_opening_stones_game FOREIGN KEY (game_id) REFERENCES games (id),
    CONSTRAINT fk_opening_stones_player FOREIGN KEY (placed_by_player_id) REFERENCES players (id)
);
CREATE UNIQUE INDEX uk_opening_stones_game_sequence ON opening_stones (game_id, sequence);
