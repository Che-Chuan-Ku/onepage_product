package com.gomoku.service;

import com.gomoku.domain.entity.Player;
import com.gomoku.domain.entity.PlayerStats;
import com.gomoku.domain.enums.PlayerType;
import com.gomoku.dto.request.GuestEnterRequest;
import com.gomoku.dto.request.LoginRequest;
import com.gomoku.dto.request.RegisterRequest;
import com.gomoku.dto.response.GuestEnterResponse;
import com.gomoku.dto.response.LoginResponse;
import com.gomoku.dto.response.PlayerDetailResponse;
import com.gomoku.exception.BusinessException;
import com.gomoku.exception.ErrorCode;
import com.gomoku.repository.PlayerRepository;
import com.gomoku.repository.PlayerStatsRepository;
import com.gomoku.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final PlayerRepository playerRepository;
    private final PlayerStatsRepository playerStatsRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(PlayerRepository playerRepository,
                       PlayerStatsRepository playerStatsRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.playerRepository = playerRepository;
        this.playerStatsRepository = playerStatsRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public PlayerDetailResponse register(RegisterRequest req) {
        if (playerRepository.existsByUsernameAndDeletedFalse(req.username())) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }
        if (playerRepository.existsByEmailAndDeletedFalse(req.email())) {
            throw new BusinessException(ErrorCode.EMAIL_TAKEN);
        }
        Player player = new Player();
        player.setPlayerType(PlayerType.REGISTERED);
        player.setUsername(req.username());
        player.setEmail(req.email());
        player.setNickname(req.username());
        player.setPasswordHash(passwordEncoder.encode(req.password()));
        player = playerRepository.save(player);

        PlayerStats stats = new PlayerStats();
        stats.setPlayerId(player.getId());
        playerStatsRepository.save(stats);

        return new PlayerDetailResponse(player.getId(), player.getUsername(), player.getEmail());
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest req) {
        Player player = playerRepository.findByUsernameAndDeletedFalse(req.username())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "帳號或密碼錯誤"));
        if (player.getPasswordHash() == null
                || !passwordEncoder.matches(req.password(), player.getPasswordHash())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "帳號或密碼錯誤");
        }
        String token = jwtService.generateToken(player.getId(), player.getUsername());
        return new LoginResponse(token, player.getId());
    }

    @Transactional
    public GuestEnterResponse enterAsGuest(GuestEnterRequest req) {
        // Q4: guests are transient (online single-session). Persist a lightweight
        // GUEST player so room membership/game FK references resolve.
        Player guest = new Player();
        guest.setPlayerType(PlayerType.GUEST);
        guest.setNickname(req.nickname());
        guest = playerRepository.save(guest);
        // Issue a JWT so the guest can reach authenticated endpoints (/rooms/**)
        // for their online single-game session (需求 #2).
        String token = jwtService.generateToken(guest.getId(), guest.getNickname());
        return new GuestEnterResponse(guest.getId(), guest.getNickname(), token);
    }
}
