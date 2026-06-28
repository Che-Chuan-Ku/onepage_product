package com.gomoku.config;

import com.gomoku.security.JwtTokenFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    private final JwtTokenFilter jwtTokenFilter;

    public SecurityConfig(JwtTokenFilter jwtTokenFilter) {
        this.jwtTokenFilter = jwtTokenFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // public: auth + read-only lobby/leaderboard + local game + ws handshake
                        .requestMatchers(
                                "/api/gmk/v1/auth/**",
                                "/api/gmk/v1/leaderboard",
                                "/api/gmk/v1/players/*/stats",
                                "/ws/**"
                        ).permitAll()
                        // local games + replays are anonymous-friendly
                        .requestMatchers(
                                "/api/gmk/v1/games",
                                "/api/gmk/v1/games/**"
                        ).permitAll()
                        .requestMatchers("/api/gmk/v1/rooms", "/api/gmk/v1/rooms/**").authenticated()
                        .anyRequest().permitAll())
                .addFilterBefore(jwtTokenFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
