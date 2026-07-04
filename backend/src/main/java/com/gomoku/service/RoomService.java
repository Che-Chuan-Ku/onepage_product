package com.gomoku.service;

import com.gomoku.domain.entity.Game;
import com.gomoku.domain.entity.GameRoom;
import com.gomoku.domain.entity.Player;
import com.gomoku.domain.entity.RoomMember;
import com.gomoku.domain.enums.BattleMode;
import com.gomoku.domain.enums.ClassType;
import com.gomoku.domain.enums.GameMode;
import com.gomoku.domain.enums.GameStatus;
import com.gomoku.domain.enums.RoomMemberRole;
import com.gomoku.domain.enums.RoomStatus;
import com.gomoku.domain.enums.RoomVisibility;
import com.gomoku.domain.enums.StoneColor;
import com.gomoku.dto.request.RoomCreateRequest;
import com.gomoku.dto.request.SelectClassRequest;
import com.gomoku.dto.response.GameDetailResponse;
import com.gomoku.dto.response.GameStartedEvent;
import com.gomoku.dto.response.QuickMatchResponse;
import com.gomoku.dto.response.RoomDetailResponse;
import com.gomoku.dto.response.RoomListResponse;
import com.gomoku.dto.response.RoomMemberItem;
import com.gomoku.exception.BusinessException;
import com.gomoku.exception.ErrorCode;
import com.gomoku.repository.GameRepository;
import com.gomoku.repository.GameRoomRepository;
import com.gomoku.repository.PlayerRepository;
import com.gomoku.repository.RoomMemberRepository;
import com.gomoku.web.PageData;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

@Service
public class RoomService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final int MAX_PLAYERS = 2;

    private final SecureRandom random = new SecureRandom();

    private final GameRoomRepository roomRepository;
    private final RoomMemberRepository memberRepository;
    private final PlayerRepository playerRepository;
    private final GameRepository gameRepository;
    private final SeriousDuelService seriousDuelService;
    private final GameBroadcaster broadcaster;

    public RoomService(GameRoomRepository roomRepository,
                       RoomMemberRepository memberRepository,
                       PlayerRepository playerRepository,
                       GameRepository gameRepository,
                       SeriousDuelService seriousDuelService,
                       GameBroadcaster broadcaster) {
        this.roomRepository = roomRepository;
        this.memberRepository = memberRepository;
        this.playerRepository = playerRepository;
        this.gameRepository = gameRepository;
        this.seriousDuelService = seriousDuelService;
        this.broadcaster = broadcaster;
    }

    /**
     * Start (or fetch) the ONLINE game for a Ready room. Idempotent: if an active
     * game is already bound to the room, returns it — so both clients can call this
     * concurrently and converge on the SAME gameId (no duplicate games / race).
     *
     * Acts as the coin toss: standard → host=BLACK, guest=WHITE, status=PLAYING;
     * Swap2 → random tentative-first, status=OPENING. Broadcasts GameStartedEvent
     * to /topic/room/{roomId} so both clients navigate to the same game.
     *
     * HTTP response shape (api.yml:423-437) is GameDetailResponse — the richer
     * GameStartedEvent (blackPlayerId/tentativeFirstPlayerId/classes/…) is kept
     * solely for the WS broadcast so REST callers and WS subscribers each get
     * the payload shaped for their purpose.
     */
    @Transactional
    public GameDetailResponse startOnlineGame(String playerId, String roomId) {
        // Pessimistic lock serializes concurrent callers: the 2nd waits, then sees
        // the game the 1st created and returns it (no duplicate, no version clash).
        GameRoom room = roomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "房間不存在"));

        // Idempotent: reuse an existing non-finished game for this room.
        Game existing = gameRepository
                .findFirstByRoomIdAndStatusNotAndDeletedFalse(roomId, GameStatus.FINISHED)
                .orElse(null);
        if (existing != null) {
            return toGameDetail(existing);
        }

        if (room.getStatus() != RoomStatus.READY) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "房間未達 Ready 狀態");
        }
        List<RoomMember> players = memberRepository
                .findByRoomIdAndRoleAndDeletedFalseOrderByCreatedAtAsc(roomId, RoomMemberRole.PLAYER);
        if (players.size() != MAX_PLAYERS) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "房間對戰人數不足");
        }

        String hostId = room.getHostPlayerId();
        String guestId = room.getGuestPlayerId();

        Game game = new Game();
        game.setGameMode(GameMode.ONLINE);
        game.setRoomId(roomId);
        game.setUseSwap2(room.isSwap2Mode());

        game.setBattleMode(room.getBattleMode());
        game.setFieldType(room.getFieldType());

        if (room.isSwap2Mode()) {
            // Swap2: coin decides tentative-first; colours finalized after opening.
            game.setStatus(GameStatus.OPENING);
            game.setTentativeFirstPlayerId(random.nextBoolean() ? hostId : guestId);
        } else {
            // Standard: host=BLACK (first), guest=WHITE.
            game.setStatus(GameStatus.PLAYING);
            game.setCurrentTurn(StoneColor.BLACK);
            game.setBlackPlayerId(hostId);
            game.setWhitePlayerId(guestId);
        }

        // Serious Duel (never Swap2, Q9): snapshot classes by color — the game
        // turning PLAYING is the ClassesRevealed moment (req #35) — and generate
        // the field (obstacles + hidden cells, req #39 #40).
        if (room.getBattleMode() == BattleMode.SERIOUS_DUEL) {
            game.setBlackClass(memberClass(players, hostId));
            game.setWhiteClass(memberClass(players, guestId));
        }
        game = gameRepository.save(game);
        if (room.getBattleMode() == BattleMode.SERIOUS_DUEL) {
            seriousDuelService.initializeField(game);
        }

        room.setStatus(RoomStatus.IN_PROGRESS);
        roomRepository.save(room);

        GameStartedEvent event = toGameStarted(game);
        broadcaster.broadcastRoom(roomId, event);
        return toGameDetail(game);
    }

    private GameStartedEvent toGameStarted(Game game) {
        return new GameStartedEvent(
                "GameStarted",
                game.getId(),
                game.isUseSwap2(),
                game.getStatus().name(),
                game.getTentativeFirstPlayerId(),
                game.getBlackPlayerId(),
                game.getWhitePlayerId(),
                game.getBattleMode().name(),
                game.getFieldType() == null ? null : game.getFieldType().name(),
                game.getBlackClass() == null ? null : game.getBlackClass().name(),
                game.getWhiteClass() == null ? null : game.getWhiteClass().name());
    }

    private ClassType memberClass(List<RoomMember> players, String playerId) {
        for (RoomMember member : players) {
            if (member.getPlayerId().equals(playerId)) {
                return member.getClassType();
            }
        }
        return null;
    }

    /** Current room snapshot (members + status) for the room page on load / reconnect. */
    @Transactional(readOnly = true)
    public RoomDetailResponse getRoom(String playerId, String roomId) {
        GameRoom room = roomRepository.findByIdAndDeletedFalse(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "房間不存在"));
        RoomMemberRole role = memberRepository
                .findByRoomIdAndPlayerIdAndDeletedFalse(roomId, playerId)
                .map(RoomMember::getRole)
                .orElse(null);
        return toDetail(room, playerId, role);
    }

    private GameDetailResponse toGameDetail(Game game) {
        return new GameDetailResponse(
                game.getId(),
                game.getGameMode().name(),
                game.isUseSwap2(),
                game.getBattleMode().name(),
                game.getFieldType() == null ? null : game.getFieldType().name(),
                game.getStatus().name(),
                game.getCurrentTurn() == null ? null : game.getCurrentTurn().name());
    }

    @Transactional
    public RoomDetailResponse createRoom(String playerId, RoomCreateRequest req) {
        BattleMode battleMode = req.battleModeOrDefault();
        // Serious Duel constraints (req #34, Q9): mutually exclusive with Swap2;
        // fieldType required for SERIOUS_DUEL and must be null otherwise.
        if (battleMode == BattleMode.SERIOUS_DUEL) {
            if (req.swap2()) {
                throw new BusinessException(ErrorCode.INVALID_MOVE, "真劍勝負模式與 Swap2 模式互斥");
            }
            if (req.fieldType() == null) {
                throw new BusinessException(ErrorCode.INVALID_MOVE, "真劍勝負模式必須指定場地");
            }
        } else if (req.fieldType() != null) {
            throw new BusinessException(ErrorCode.INVALID_MOVE, "非真劍勝負模式不可指定場地");
        }

        GameRoom room = new GameRoom();
        room.setRoomCode(generateUniqueCode());
        room.setVisibility(req.visibility());
        room.setStatus(RoomStatus.WAITING);
        room.setSwap2Mode(req.swap2());
        room.setBattleMode(battleMode);
        room.setFieldType(req.fieldType());
        room.setHostPlayerId(playerId);
        room = roomRepository.save(room);

        RoomMember host = new RoomMember();
        host.setRoomId(room.getId());
        host.setPlayerId(playerId);
        host.setRole(RoomMemberRole.PLAYER);
        memberRepository.save(host);

        return toDetail(room, playerId, RoomMemberRole.PLAYER);
    }

    /**
     * Serious Duel class selection (req #35, Q8): PLAYER seats only, before
     * Ready; Ready locks the choice. Both players may pick the same class.
     * The ClassSelected broadcast carries no classType — choices stay hidden
     * from the opponent until the game starts (spectators read via GET).
     */
    @Transactional
    public RoomDetailResponse selectClass(String playerId, String roomId, SelectClassRequest req) {
        GameRoom room = roomRepository.findByIdAndDeletedFalse(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "房間不存在"));
        RoomMember member = memberRepository
                .findByRoomIdAndPlayerIdAndDeletedFalse(roomId, playerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "不在房間中"));

        if (member.getRole() != RoomMemberRole.PLAYER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "觀戰者不可選擇職業");
        }
        if (room.getBattleMode() != BattleMode.SERIOUS_DUEL) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "非真劍勝負房間");
        }
        if (member.isReady()) {
            throw new BusinessException(ErrorCode.UNPROCESSABLE, "職業已鎖定，無法變更");
        }

        member.setClassType(req.classType());
        memberRepository.save(member);

        broadcaster.broadcastRoom(roomId, java.util.Map.of(
                "event", "ClassSelected",
                "playerId", playerId));
        return toDetail(room, playerId, member.getRole());
    }

    @Transactional(readOnly = true)
    public PageData<RoomListResponse> listPublicRooms(int skip, int top) {
        int page = top <= 0 ? 0 : skip / top;
        List<GameRoom> rooms = roomRepository
                .findByVisibilityAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                        RoomVisibility.PUBLIC, RoomStatus.WAITING, PageRequest.of(page, Math.max(top, 1)));
        long total = roomRepository.countByVisibilityAndStatusAndDeletedFalse(
                RoomVisibility.PUBLIC, RoomStatus.WAITING);

        List<RoomListResponse> items = new ArrayList<>();
        for (GameRoom r : rooms) {
            long players = memberRepository.countByRoomIdAndRoleAndDeletedFalse(r.getId(), RoomMemberRole.PLAYER);
            long spectators = memberRepository.countByRoomIdAndRoleAndDeletedFalse(r.getId(), RoomMemberRole.SPECTATOR);
            items.add(new RoomListResponse(
                    r.getId(),
                    r.getRoomCode(),
                    nickname(r.getHostPlayerId()),
                    (int) players,
                    (int) spectators,
                    r.isSwap2Mode(),
                    r.getBattleMode().name(),
                    r.getFieldType() == null ? null : r.getFieldType().name()));
        }
        return new PageData<>(items, total);
    }

    /**
     * Join: PLAYER seat if < 2 (Q5), otherwise SPECTATOR (read-only).
     */
    @Transactional
    public RoomDetailResponse joinRoom(String playerId, String roomIdOrCode) {
        // 支援用 roomId(UUID) 或 6 碼 roomCode 加入（spec：輸入房間碼加入）
        GameRoom room = roomRepository.findByIdAndDeletedFalse(roomIdOrCode)
                .or(() -> roomRepository.findByRoomCodeAndDeletedFalse(roomIdOrCode))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "房間不存在"));
        String roomId = room.getId();

        RoomMember existing = memberRepository
                .findByRoomIdAndPlayerIdAndDeletedFalse(roomId, playerId).orElse(null);
        if (existing != null) {
            broadcaster.broadcastRoom(roomId, toDetail(room, null, null));
            return toDetail(room, playerId, existing.getRole());
        }

        long playerCount = memberRepository.countByRoomIdAndRoleAndDeletedFalse(roomId, RoomMemberRole.PLAYER);
        RoomMemberRole role = (playerCount < MAX_PLAYERS) ? RoomMemberRole.PLAYER : RoomMemberRole.SPECTATOR;

        RoomMember member = new RoomMember();
        member.setRoomId(roomId);
        member.setPlayerId(playerId);
        member.setRole(role);
        memberRepository.save(member);

        if (role == RoomMemberRole.PLAYER && room.getGuestPlayerId() == null
                && !playerId.equals(room.getHostPlayerId())) {
            room.setGuestPlayerId(playerId);
            roomRepository.save(room);
        }

        broadcaster.broadcastRoom(roomId, toDetail(room, null, null));
        return toDetail(room, playerId, role);
    }

    /**
     * Quick match (Q6): join an open waiting public room, else create a queue room.
     * 60s timeout is enforced by the caller/scheduler + WS notification.
     */
    @Transactional
    public QuickMatchResponse quickMatch(String playerId) {
        GameRoom waiting = roomRepository
                .findFirstByVisibilityAndStatusAndDeletedFalseOrderByCreatedAtAsc(
                        RoomVisibility.PUBLIC, RoomStatus.WAITING)
                .filter(r -> !r.getHostPlayerId().equals(playerId) && r.getGuestPlayerId() == null)
                .orElse(null);

        if (waiting != null) {
            joinRoom(playerId, waiting.getId());
            return new QuickMatchResponse(true, waiting.getId(), null);
        }

        // No opponent yet: open a public waiting room and report queued.
        GameRoom room = new GameRoom();
        room.setRoomCode(generateUniqueCode());
        room.setVisibility(RoomVisibility.PUBLIC);
        room.setStatus(RoomStatus.WAITING);
        room.setHostPlayerId(playerId);
        room = roomRepository.save(room);

        RoomMember host = new RoomMember();
        host.setRoomId(room.getId());
        host.setPlayerId(playerId);
        host.setRole(RoomMemberRole.PLAYER);
        memberRepository.save(host);

        return new QuickMatchResponse(false, room.getId(), 1);
    }

    /**
     * Toggle Ready (Q5: only PLAYER seats; SPECTATOR -> 403). Both players ready
     * transitions room to READY.
     */
    @Transactional
    public RoomDetailResponse toggleReady(String playerId, String roomId) {
        // 悲觀鎖序列化並發 toggle：避免雙方同時按 Ready 時各自讀不到對方的 ready
        // 而都算成 WAITING，導致房間永遠進不了 READY。
        GameRoom room = roomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "房間不存在"));
        RoomMember member = memberRepository
                .findByRoomIdAndPlayerIdAndDeletedFalse(roomId, playerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "不在房間中"));

        if (member.getRole() != RoomMemberRole.PLAYER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "觀戰者不可切換 Ready");
        }
        member.setReady(!member.isReady());
        memberRepository.save(member);

        List<RoomMember> players = memberRepository.findByRoomIdAndRoleAndDeletedFalseOrderByCreatedAtAsc(roomId, RoomMemberRole.PLAYER);
        boolean allReady = players.size() == MAX_PLAYERS && players.stream().allMatch(RoomMember::isReady);
        room.setStatus(allReady ? RoomStatus.READY : RoomStatus.WAITING);
        roomRepository.save(room);

        broadcaster.broadcastRoom(roomId, toDetail(room, null, null));
        return toDetail(room, playerId, member.getRole());
    }

    // ── helpers ──────────────────────────────────────────────────────

    /**
     * Room snapshot for a specific viewer. Serious Duel classType visibility
     * (Q8, R2-2): before the game starts, opposing PLAYERs see null for each
     * other's choice; a member always sees their own; SPECTATOR viewers see
     * everything at any stage. Once the room is IN_PROGRESS/FINISHED (i.e. the
     * game turned PLAYING → ClassesRevealed) everyone sees both classes.
     * Broadcast copies use viewerId=null/viewerRole=null → most restrictive.
     */
    private RoomDetailResponse toDetail(GameRoom room, String viewerId, RoomMemberRole viewerRole) {
        // Ordered by join time so the host (first PLAYER) is always members[0]
        // — the room/game pages depend on stable slot 0/1 = host/guest.
        List<RoomMember> members = memberRepository.findByRoomIdAndDeletedFalseOrderByCreatedAtAsc(room.getId());
        boolean revealed = room.getStatus() == RoomStatus.IN_PROGRESS
                || room.getStatus() == RoomStatus.FINISHED;
        List<RoomMemberItem> memberItems = new ArrayList<>();
        int spectatorCount = 0;
        for (RoomMember m : members) {
            if (m.getRole() == RoomMemberRole.SPECTATOR) {
                spectatorCount++;
            }
            boolean classVisible = revealed
                    || (viewerId != null && viewerId.equals(m.getPlayerId()))
                    || viewerRole == RoomMemberRole.SPECTATOR;
            memberItems.add(new RoomMemberItem(
                    m.getPlayerId(),
                    nickname(m.getPlayerId()),
                    m.getRole().name(),
                    m.isReady(),
                    classVisible && m.getClassType() != null ? m.getClassType().name() : null));
        }
        return new RoomDetailResponse(
                room.getId(),
                room.getRoomCode(),
                room.getVisibility().name(),
                room.getStatus().name(),
                room.isSwap2Mode(),
                room.getBattleMode().name(),
                room.getFieldType() == null ? null : room.getFieldType().name(),
                room.getHostPlayerId(),
                viewerRole == null ? null : viewerRole.name(),
                spectatorCount,
                memberItems);
    }

    private String nickname(String playerId) {
        Player p = playerRepository.findById(playerId).orElse(null);
        if (p == null) {
            return null;
        }
        return p.getNickname() != null ? p.getNickname() : p.getUsername();
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!roomRepository.existsByRoomCodeAndDeletedFalse(code)) {
                return code;
            }
        }
        throw new BusinessException(ErrorCode.INTERNAL_ERROR, "無法產生唯一房間碼");
    }
}
