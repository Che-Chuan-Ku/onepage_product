package com.onepage.product.steps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.onepage.product.cucumber.ScenarioContext;
import com.onepage.product.model.User;
import com.onepage.product.repository.UserRepository;
import io.cucumber.java.en.*;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class CreateUserSteps {

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

    @When("管理員建立新使用者 Email 為 {string} 姓名為 {string} 密碼為 {string} 角色為 {string}")
    public void 管理員建立新使用者(String email, String name, String password, String role) {
        // Clean up if exists from previous test
        userRepository.findByEmail(email).ifPresent(u -> userRepository.delete(u));

        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("name", name);
        body.put("password", password);
        body.put("role", role);

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("application/json")
                .body(body)
                .post("/users");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("新使用者建立成功且回傳 {int}")
    public void 新使用者建立成功且回傳(int expectedStatus) throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(expectedStatus);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.has("id")).isTrue();
        assertThat(json.has("email")).isTrue();
    }

    @Given("系統中已有使用者 {string}")
    public void 系統中已有使用者(String email) {
        if (!userRepository.existsByEmail(email)) {
            User user = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode("password"))
                    .name("現有使用者")
                    .role(User.UserRole.GENERAL_USER)
                    .build();
            userRepository.save(user);
        }
    }

    @When("管理員嘗試建立 Email 為 {string} 的新使用者")
    public void 管理員嘗試建立重複Email的使用者(String email) {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("name", "重複使用者");
        body.put("password", "Password123");
        body.put("role", "GENERAL_USER");

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("application/json")
                .body(body)
                .post("/users");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("系統回傳 {int} 衝突")
    public void 系統回傳衝突(int statusCode) {
        assertThat(lastResponse.getStatusCode()).isEqualTo(statusCode);
    }

    @When("管理員建立新使用者密碼為 {string}（7碼）")
    public void 管理員建立新使用者密碼為7碼(String password) {
        Map<String, Object> body = new HashMap<>();
        body.put("email", "shortpwd@example.com");
        body.put("name", "測試使用者");
        body.put("password", password);
        body.put("role", "GENERAL_USER");

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("application/json")
                .body(body)
                .post("/users");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("系統回傳 {int} 驗證失敗")
    public void 系統回傳驗證失敗(int statusCode) {
        assertThat(lastResponse.getStatusCode()).isEqualTo(statusCode);
    }

    @When("一般使用者嘗試建立新使用者")
    public void 一般使用者嘗試建立新使用者() {
        Map<String, Object> body = new HashMap<>();
        body.put("email", "attempt@example.com");
        body.put("name", "測試");
        body.put("password", "Password123");
        body.put("role", "GENERAL_USER");

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("application/json")
                .body(body)
                .post("/users");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }
}
