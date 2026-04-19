package com.onepage.product.service;

import com.onepage.product.dto.auth.CreateUserRequest;
import com.onepage.product.dto.auth.LoginRequest;
import com.onepage.product.dto.auth.LoginResponse;
import com.onepage.product.dto.auth.TokenResponse;
import com.onepage.product.dto.auth.UserDTO;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.User;
import com.onepage.product.repository.UserRepository;
import com.onepage.product.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_DURATION_MINUTES = 30;

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public LoginResponse login(LoginRequest request, String clientIp) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BusinessException("帳號或密碼錯誤", HttpStatus.UNAUTHORIZED));

        if (user.isLocked()) {
            throw new BusinessException("帳號已鎖定，請 30 分鐘後再試", HttpStatus.LOCKED);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            handleFailedLogin(user);
            throw new BusinessException("帳號或密碼錯誤", HttpStatus.UNAUTHORIZED);
        }

        // Reset failed login count on success
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(LocalDateTime.now());
        user.setLastLoginIp(clientIp);
        userRepository.save(user);

        String accessToken = jwtUtil.generateAccessToken(user.getEmail(), user.getRole().name());
        String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .role(user.getRole().name())
                .userName(user.getName())
                .build();
    }

    @Transactional
    public TokenResponse refreshToken(String refreshToken) {
        if (!jwtUtil.isTokenValid(refreshToken)) {
            throw new BusinessException("Refresh Token 無效或已過期", HttpStatus.UNAUTHORIZED);
        }
        if (!"refresh".equals(jwtUtil.getTypeFromToken(refreshToken))) {
            throw new BusinessException("Refresh Token 無效或已過期", HttpStatus.UNAUTHORIZED);
        }

        String email = jwtUtil.getEmailFromToken(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("使用者不存在", HttpStatus.UNAUTHORIZED));

        String newAccessToken = jwtUtil.generateAccessToken(user.getEmail(), user.getRole().name());
        return new TokenResponse(newAccessToken);
    }

    @Transactional(readOnly = true)
    public List<UserDTO> listUsers() {
        return userRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // REQ-033: 建立使用者（管理員限定）
    @Transactional
    public UserDTO createUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("此 Email 已被使用", HttpStatus.CONFLICT);
        }

        User.UserRole role;
        try {
            role = User.UserRole.valueOf(request.getRole());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("角色值不合法", HttpStatus.BAD_REQUEST);
        }

        User user = User.builder()
                .email(request.getEmail())
                .name(request.getName())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(role)
                .build();

        user = userRepository.save(user);

        // sendWelcomeEmail is handled by email notification service (future integration)
        // For now just log the intent
        if (request.isSendWelcomeEmail()) {
            log.info("Welcome email requested for new user: {}", user.getEmail());
        }

        return toDTO(user);
    }

    @Transactional
    public UserDTO updateUserRole(Long userId, String roleStr) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("使用者不存在", HttpStatus.NOT_FOUND));

        User.UserRole newRole = User.UserRole.valueOf(roleStr);

        // Cannot downgrade the last admin
        if (user.getRole() == User.UserRole.ADMIN
                && newRole == User.UserRole.GENERAL_USER
                && userRepository.countByRole(User.UserRole.ADMIN) <= 1) {
            throw new BusinessException("不可將最後一位管理員降級", HttpStatus.BAD_REQUEST);
        }

        user.setRole(newRole);
        return toDTO(userRepository.save(user));
    }

    private void handleFailedLogin(User user) {
        int failedCount = user.getFailedLoginCount() + 1;
        user.setFailedLoginCount(failedCount);

        if (failedCount >= MAX_FAILED_ATTEMPTS) {
            user.setLockedUntil(LocalDateTime.now().plusMinutes(LOCK_DURATION_MINUTES));
            log.warn("Account locked for user: {}", user.getEmail());
        }

        userRepository.save(user);
    }

    private UserDTO toDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .build();
    }
}
