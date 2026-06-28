package com.gomoku.domain.entity;

import com.gomoku.domain.enums.PlayerType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "players")
public class Player extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "player_type", nullable = false, length = 20)
    private PlayerType playerType;

    @Column(name = "username", length = 50)
    private String username;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "nickname", length = 50)
    private String nickname;

    public PlayerType getPlayerType() { return playerType; }
    public void setPlayerType(PlayerType playerType) { this.playerType = playerType; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
}
