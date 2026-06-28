package com.gomoku.steps.common_given;

import com.gomoku.cucumber.ScenarioContext;
import io.cucumber.java.Before;
import io.cucumber.java.DataTableType;
import io.cucumber.java.en.Given;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

/**
 * Shared Given steps used across multiple feature categories.
 * Covers: player registration/login, pre-seeded data setup.
 */
public class CommonGiven {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ScenarioContext ctx;

    @Before
    public void resetContext() {
        ctx.clear();
    }

    // ----------------------------------------------------------------
    // Player registration + login helpers
    // ----------------------------------------------------------------

    /**
     * Registers a player and stores their JWT in ScenarioContext under "token:<username>".
     * Handles DataTable with columns: username, email (password defaulted to "P@ssw0rd1"),
     * or username, password columns.
     */
    @Given("系統中已存在以下玩家：")
    public void systemHasPlayers(List<Map<String, String>> rows) {
        for (Map<String, String> row : rows) {
            String username = row.get("username");
            String email = row.getOrDefault("email", username + "@example.com");
            String password = row.getOrDefault("password", "P@ssw0rd1");

            // Register
            String registerBody = String.format(
                    "{\"username\":\"%s\",\"email\":\"%s\",\"password\":\"%s\"}",
                    username, email, password);
            HttpHeaders headers = jsonHeaders();
            restTemplate.postForEntity(
                    "/api/gmk/v1/auth/register",
                    new HttpEntity<>(registerBody, headers),
                    Map.class);

            // Login to get token
            String loginBody = String.format(
                    "{\"username\":\"%s\",\"password\":\"%s\"}", username, password);
            @SuppressWarnings("unchecked")
            ResponseEntity<Map> loginResp = restTemplate.postForEntity(
                    "/api/gmk/v1/auth/login",
                    new HttpEntity<>(loginBody, headers),
                    Map.class);
            if (loginResp.getBody() != null) {
                Object dataObj = loginResp.getBody().get("data");
                if (dataObj instanceof Map<?, ?> dataMap) {
                    String token = (String) dataMap.get("token");
                    String playerId = (String) dataMap.get("playerId");
                    ctx.putMemo("token:" + username, token);
                    ctx.putMemo("playerId:" + username, playerId);
                }
            }
        }
    }

    /** Step: 玩家 "alice" 已登入 */
    @Given("玩家 {string} 已登入")
    public void playerIsLoggedIn(String username) {
        if (ctx.getMemo("token:" + username) == null) {
            // Register + login the player
            String email = username + "@example.com";
            String password = "P@ssw0rd1";
            HttpHeaders headers = jsonHeaders();

            restTemplate.postForEntity(
                    "/api/gmk/v1/auth/register",
                    new HttpEntity<>(String.format(
                            "{\"username\":\"%s\",\"email\":\"%s\",\"password\":\"%s\"}",
                            username, email, password), headers),
                    Map.class);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map> loginResp = restTemplate.postForEntity(
                    "/api/gmk/v1/auth/login",
                    new HttpEntity<>(String.format(
                            "{\"username\":\"%s\",\"password\":\"%s\"}", username, password),
                            headers),
                    Map.class);
            if (loginResp.getBody() != null) {
                Object dataObj = loginResp.getBody().get("data");
                if (dataObj instanceof Map<?, ?> dataMap) {
                    ctx.putMemo("token:" + username, dataMap.get("token"));
                    ctx.putMemo("playerId:" + username, dataMap.get("playerId"));
                }
            }
        }
    }

    // ----------------------------------------------------------------
    // Utility
    // ----------------------------------------------------------------

    public HttpHeaders jsonHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }

    public HttpHeaders authHeaders(String username) {
        HttpHeaders h = jsonHeaders();
        Object token = ctx.getMemo("token:" + username);
        if (token != null) {
            h.setBearerAuth(token.toString());
        }
        return h;
    }
}
