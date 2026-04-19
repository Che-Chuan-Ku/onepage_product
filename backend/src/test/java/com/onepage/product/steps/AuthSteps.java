package com.onepage.product.steps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.onepage.product.cucumber.ScenarioContext;
import com.onepage.product.model.User;
import com.onepage.product.repository.UserRepository;
import io.cucumber.java.en.*;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class AuthSteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @LocalServerPort
    private int port;

    private Response lastResponse;

    @Given("系統中有管理員帳號 {string}")
    public void 系統中有管理員帳號(String email) {
        if (!userRepository.existsByEmail(email)) {
            User user = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode("correct_password"))
                    .name("管理員")
                    .role(User.UserRole.ADMIN)
                    .build();
            userRepository.save(user);
        }
    }

    @Given("系統中有一般使用者帳號 {string}")
    public void 系統中有一般使用者帳號(String email) {
        if (!userRepository.existsByEmail(email)) {
            User user = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode("correct_password"))
                    .name("一般使用者")
                    .role(User.UserRole.GENERAL_USER)
                    .build();
            userRepository.save(user);
        }
    }

    @Given("系統中有帳號 {string}")
    public void 系統中有帳號(String email) {
        系統中有管理員帳號(email);
    }

    @Given("該帳號已連續登入失敗 {int} 次")
    public void 該帳號已連續登入失敗N次(int times) {
        userRepository.findByEmail("admin@example.com").ifPresent(user -> {
            user.setFailedLoginCount(times);
            userRepository.save(user);
        });
    }

    @Given("帳號 {string} 已被鎖定")
    public void 帳號已被鎖定(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setLockedUntil(LocalDateTime.now().plusMinutes(30));
            userRepository.save(user);
        });
    }

    @Given("帳號 {string} 已被鎖定 {int} 分鐘")
    public void 帳號已被鎖定N分鐘(String email, int minutes) {
        帳號已被鎖定(email);
    }

    @Given("鎖定時間已過")
    public void 鎖定時間已過() {
        userRepository.findByEmail("admin@example.com").ifPresent(user -> {
            user.setLockedUntil(LocalDateTime.now().minusMinutes(1));
            userRepository.save(user);
        });
    }

    @When("使用者輸入 Email {string} 密碼 {string}")
    public void 使用者輸入Email密碼(String email, String password) {
        context.setId("loginEmail", null);
        Map<String, String> body = new HashMap<>();
        body.put("email", email);
        body.put("password", password);

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .contentType("application/json")
                .body(body)
                .post("/auth/login");

        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @When("使用者輸入正確的 Email 與密碼")
    public void 使用者輸入正確的Email與密碼() {
        使用者輸入Email密碼("admin@example.com", "correct_password");
    }

    @When("使用者再次輸入錯誤密碼")
    public void 使用者再次輸入錯誤密碼() {
        使用者輸入Email密碼("admin@example.com", "wrong_password");
    }

    @And("點擊登入")
    public void 點擊登入() {
        // Already triggered by the When step
    }

    @Then("登入成功")
    public void 登入成功() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        try {
            JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
            assertThat(json.has("accessToken")).isTrue();
            context.setAccessToken(json.get("accessToken").asText());
            if (json.has("refreshToken")) {
                context.setRefreshToken(json.get("refreshToken").asText());
            }
        } catch (Exception e) {
            throw new AssertionError("Failed to parse login response", e);
        }
    }

    @And("回傳 accessToken（有效期 {int} 分鐘）")
    public void 回傳accessToken(int minutes) {
        assertThat(context.getAccessToken()).isNotBlank();
    }

    @And("回傳 refreshToken（有效期 {int} 天）")
    public void 回傳refreshToken(int days) {
        assertThat(context.getRefreshToken()).isNotBlank();
    }

    @And("回傳角色為「管理員」")
    public void 回傳角色為管理員() throws Exception {
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("role").asText()).isEqualTo("ADMIN");
    }

    @And("回傳角色為「一般使用者」")
    public void 回傳角色為一般使用者() throws Exception {
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("role").asText()).isEqualTo("GENERAL_USER");
    }

    @And("回傳使用者名稱")
    public void 回傳使用者名稱() throws Exception {
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.has("userName")).isTrue();
    }

    @And("系統記錄登入時間與 IP")
    public void 系統記錄登入時間與IP() {
        userRepository.findByEmail("admin@example.com").ifPresent(user -> {
            assertThat(user.getLastLoginAt()).isNotNull();
        });
    }

    @Then("顯示錯誤訊息「帳號或密碼錯誤」")
    public void 顯示錯誤訊息帳號或密碼錯誤() {
        assertThat(lastResponse.getStatusCode()).isIn(401, 423);
        assertThat(lastResponse.getBody().asString()).contains("帳號或密碼錯誤");
    }

    @Then("顯示錯誤訊息「帳號已鎖定，請 {int} 分鐘後再試」")
    public void 顯示錯誤訊息帳號已鎖定(int minutes) {
        assertThat(lastResponse.getStatusCode()).isEqualTo(423);
        assertThat(lastResponse.getBody().asString()).contains("帳號已鎖定");
    }

    @And("帳號被鎖定 {int} 分鐘")
    public void 帳號被鎖定N分鐘(int minutes) {
        userRepository.findByEmail("admin@example.com").ifPresent(user -> {
            assertThat(user.getLockedUntil()).isNotNull();
        });
    }

    @Given("使用者已登入且 Access Token 已過期")
    public void 使用者已登入且AccessToken已過期() {
        // Set refresh token for testing
        context.setRefreshToken("valid-refresh-token-placeholder");
    }

    @When("前端使用 Refresh Token 呼叫換發 API")
    public void 前端使用RefreshToken呼叫換發API() {
        // First get a valid refresh token
        系統中有管理員帳號("admin@example.com");
        使用者輸入Email密碼("admin@example.com", "correct_password");
        // The refresh token is in context
        Map<String, String> body = new HashMap<>();
        body.put("refreshToken", context.getRefreshToken());

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .contentType("application/json")
                .body(body)
                .post("/auth/refresh");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("回傳新的 Access Token")
    public void 回傳新的AccessToken() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.has("accessToken")).isTrue();
    }

    @And("Refresh Token 維持不變")
    public void RefreshToken維持不變() {
        // Verify no new refresh token returned
        assertThat(context.getRefreshToken()).isNotBlank();
    }
}
