package com.onepage.product.steps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.onepage.product.cucumber.ScenarioContext;
import com.onepage.product.model.EmailTemplate;
import com.onepage.product.model.User;
import com.onepage.product.repository.EmailTemplateRepository;
import com.onepage.product.repository.UserRepository;
import io.cucumber.java.en.*;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class NotificationSteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private EmailTemplateRepository emailTemplateRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @LocalServerPort
    private int port;

    private Response lastResponse;

    @Given("系統已有 Email 通知模板")
    public void 系統已有Email通知模板() {
        // Templates are now owner-specific; this is handled by initializeUserTemplates in the service
    }

    // REQ-034: Templates are owner-scoped - the service auto-initializes for each user
    @Given("管理員的 Email 模板已初始化")
    public void 管理員的Email模板已初始化() {
        // Ensure templates exist for admin by calling the list endpoint
        // The service will auto-create defaults if none exist
        String email = "admin@example.com";
        User admin = userRepository.findByEmail(email).orElseThrow();
        if (emailTemplateRepository.findByOwnerUserId(admin.getId()).isEmpty()) {
            // Templates will be auto-created by the service on first list call
        }
    }

    @When("管理員查詢 Email 通知模板清單")
    public void 管理員查詢Email通知模板清單() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .get("/email-templates");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @When("管理員取得模板清單")
    public void 管理員取得模板清單() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .get("/email-templates");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("模板清單回傳成功且含四種模板")
    public void 模板清單回傳成功且含四種模板() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.isArray()).isTrue();
        assertThat(json.size()).isGreaterThanOrEqualTo(4);
    }

    @Then("回傳 Email 通知模板清單")
    public void 回傳Email通知模板清單() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
    }

    @When("管理員更新 Email 通知模板內容")
    public void 管理員更新Email通知模板內容() {
        // First get templates to find an ID
        管理員取得模板清單();
        try {
            JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
            if (json.isArray() && json.size() > 0) {
                Long templateId = json.get(0).get("id").asLong();
                context.setId("templateId", templateId);

                lastResponse = RestAssured.given()
                        .baseUri("http://localhost:" + port)
                        .basePath("/api/v1")
                        .header("Authorization", "Bearer " + context.getAccessToken())
                        .contentType("application/json")
                        .body(Map.of(
                                "subject", "新的主旨",
                                "bodyHtml", "<p>新的模板內容 {{orderNumber}}</p>"))
                        .put("/email-templates/" + templateId);
                context.setLastStatusCode(lastResponse.getStatusCode());
                context.setLastResponseBody(lastResponse.getBody().asString());
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @When("管理員更新模板標題為空字串")
    public void 管理員更新模板標題為空字串() {
        管理員取得模板清單();
        try {
            JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
            if (json.isArray() && json.size() > 0) {
                Long templateId = json.get(0).get("id").asLong();
                lastResponse = RestAssured.given()
                        .baseUri("http://localhost:" + port)
                        .basePath("/api/v1")
                        .header("Authorization", "Bearer " + context.getAccessToken())
                        .contentType("application/json")
                        .body(Map.of("subject", "", "bodyHtml", "<p>內容</p>"))
                        .put("/email-templates/" + templateId);
                context.setLastStatusCode(lastResponse.getStatusCode());
                context.setLastResponseBody(lastResponse.getBody().asString());
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Then("模板更新成功")
    public void 模板更新成功() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("subject").asText()).isEqualTo("新的主旨");
    }

    @When("嘗試存取 Email 通知模板管理頁")
    public void 嘗試存取Email通知模板管理頁() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .get("/email-templates");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    // REQ-032: Variable descriptions
    @Then("模板清單包含可用變數說明")
    public void 模板清單包含可用變數說明() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.isArray() && json.size() > 0).isTrue();
        JsonNode firstTemplate = json.get(0);
        assertThat(firstTemplate.has("availableVariables")).isTrue();
        assertThat(firstTemplate.get("availableVariables").isArray()).isTrue();
        assertThat(firstTemplate.get("availableVariables").size()).isGreaterThan(0);
    }

    @And("變數清單包含 {string} 說明為 {string}")
    public void 變數清單包含說明為(String variable, String description) throws Exception {
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        JsonNode vars = json.get(0).get("availableVariables");
        boolean found = false;
        for (JsonNode v : vars) {
            if (v.get("variable").asText().equals(variable)
                    && v.get("description").asText().equals(description)) {
                found = true;
                break;
            }
        }
        assertThat(found).withFailMessage("Variable %s with description %s not found", variable, description).isTrue();
    }

    @When("管理員預覽模板")
    public void 管理員預覽模板() {
        管理員取得模板清單();
        try {
            JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
            if (json.isArray() && json.size() > 0) {
                Long templateId = json.get(0).get("id").asLong();
                lastResponse = RestAssured.given()
                        .baseUri("http://localhost:" + port)
                        .basePath("/api/v1")
                        .header("Authorization", "Bearer " + context.getAccessToken())
                        .get("/email-templates/" + templateId + "/preview");
                context.setLastStatusCode(lastResponse.getStatusCode());
                context.setLastResponseBody(lastResponse.getBody().asString());
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Then("預覽結果中 websiteName 被替換為範例值")
    public void 預覽結果中websiteName被替換為範例值() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        String body = lastResponse.getBody().asString();
        // The preview should not contain the raw placeholder {{websiteName}}
        assertThat(body).doesNotContain("{{websiteName}}");
    }
}
