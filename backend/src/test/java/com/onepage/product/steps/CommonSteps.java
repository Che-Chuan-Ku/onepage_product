package com.onepage.product.steps;

import com.onepage.product.cucumber.ScenarioContext;
import com.onepage.product.model.User;
import com.onepage.product.repository.UserRepository;
import com.onepage.product.security.JwtUtil;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Slf4j
public class CommonSteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @LocalServerPort
    private int port;

    @Given("管理員已登入後台")
    public void 管理員已登入後台() {
        // Ensure admin user exists
        if (!userRepository.existsByEmail("admin@example.com")) {
            User admin = User.builder()
                    .email("admin@example.com")
                    .passwordHash(passwordEncoder.encode("correct_password"))
                    .name("測試管理員")
                    .role(User.UserRole.ADMIN)
                    .build();
            userRepository.save(admin);
        }

        // Get access token
        Map<String, String> body = new HashMap<>();
        body.put("email", "admin@example.com");
        body.put("password", "correct_password");

        Response response = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .contentType("application/json")
                .body(body)
                .post("/auth/login");

        if (response.getStatusCode() == 200) {
            context.setAccessToken(response.jsonPath().getString("accessToken"));
        } else {
            log.error("Login failed with status {}: {}", response.getStatusCode(), response.getBody().asString());
            throw new RuntimeException("Admin login failed in test setup");
        }
    }

    protected String authHeader() {
        return "Bearer " + context.getAccessToken();
    }

    protected String baseUri(int port) {
        return "http://localhost:" + port + "/api/v1";
    }
}
