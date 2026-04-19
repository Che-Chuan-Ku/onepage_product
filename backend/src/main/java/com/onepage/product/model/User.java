package com.onepage.product.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private UserRole role = UserRole.GENERAL_USER;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Column(name = "failed_login_count")
    private int failedLoginCount = 0;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "last_login_ip", length = 45)
    private String lastLoginIp;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public boolean isLocked() {
        return lockedUntil != null && LocalDateTime.now().isBefore(lockedUntil);
    }

    public enum UserRole {
        ADMIN, GENERAL_USER
    }
}
