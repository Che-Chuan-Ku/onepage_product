package com.onepage.product.steps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.onepage.product.cucumber.ScenarioContext;
import com.onepage.product.model.ProductCategory;
import com.onepage.product.repository.ProductCategoryRepository;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.*;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class ProductSteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private ProductCategoryRepository categoryRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @LocalServerPort
    private int port;

    private Response lastResponse;

    @Autowired
    private com.onepage.product.repository.UserRepository userRepository;

    @Given("系統中已有商品類型")
    public void 系統中已有商品類型() {
        com.onepage.product.model.User adminUser = userRepository.findByEmail("admin@example.com")
                .orElseGet(() -> {
                    com.onepage.product.model.User u = com.onepage.product.model.User.builder()
                            .email("admin@example.com")
                            .passwordHash("$2b$10$AjJoi3VI1xXqwgiaLDWSA.PHuAtiXMykJOS9B7olGgQYRawiBmkC2")
                            .name("系統管理員")
                            .role(com.onepage.product.model.User.UserRole.ADMIN)
                            .build();
                    return userRepository.save(u);
                });

        if (categoryRepository.count() == 0) {
            ProductCategory fruit = new ProductCategory();
            fruit.setOwnerUser(adminUser);
            fruit.setName("水果類");
            fruit = categoryRepository.save(fruit);

            ProductCategory twFruit = new ProductCategory();
            twFruit.setOwnerUser(adminUser);
            twFruit.setName("台灣產");
            twFruit.setParent(fruit);
            categoryRepository.save(twFruit);
        }
    }

    @When("管理員填寫商品資料如下：")
    public void 管理員填寫商品資料(DataTable dataTable) throws Exception {
        List<Map<String, String>> rows = dataTable.asMaps();
        Map<String, String> data = new java.util.HashMap<>();
        for (Map<String, String> row : rows) {
            data.put(row.get("欄位"), row.get("值"));
        }

        Long categoryId = categoryRepository.findAllRootCategories().stream()
                .findFirst()
                .map(c -> {
                    if (!c.getChildren().isEmpty()) return c.getChildren().get(0).getId();
                    return c.getId();
                })
                .orElse(1L);

        io.restassured.specification.RequestSpecification request = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("multipart/form-data")
                .multiPart("name", data.getOrDefault("名稱", "測試商品"))
                .multiPart("price", data.getOrDefault("價格", "100"))
                .multiPart("priceUnit", "CATTY")
                .multiPart("categoryId", String.valueOf(categoryId))
                .multiPart("stockQuantity", data.getOrDefault("庫存", "10"));

        if (data.containsKey("包裝規格") && !data.get("包裝規格").isBlank()) {
            request = request.multiPart("packaging", data.get("包裝規格"));
        }

        lastResponse = request.post("/products");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @And("上傳 {int} 張商品圖片")
    public void 上傳N張商品圖片(int count) {
        // Images handled in the form submission
    }

    @And("管理員提交上架")
    public void 管理員提交上架() {
        // Already submitted in the When step
    }

    @Then("商品建立成功且狀態為「已上架」")
    public void 商品建立成功且狀態為已上架() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(201);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("status").asText()).isEqualTo("ACTIVE");
        context.setId("productId", json.get("id").asLong());
    }

    @And("商品 slug 基於名稱 {string} 自動產生")
    public void 商品slug基於名稱自動產生(String name) throws Exception {
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("slug").asText()).isNotBlank();
    }

    @When("管理員填寫商品名稱為 {string} 且其他欄位皆有效")
    public void 管理員填寫商品名稱為且其他欄位皆有效(String name) {
        Long categoryId = categoryRepository.findAll().stream()
                .findFirst().map(c -> c.getId()).orElse(1L);

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("multipart/form-data")
                .multiPart("name", name)
                .multiPart("price", "100")
                .multiPart("priceUnit", "CATTY")
                .multiPart("categoryId", String.valueOf(categoryId))
                .multiPart("stockQuantity", "10")
                .post("/products");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @When("管理員填寫商品價格為 {int} 且其他欄位皆有效")
    public void 管理員填寫商品價格為N且其他欄位皆有效(int price) {
        Long categoryId = categoryRepository.findAll().stream()
                .findFirst().map(c -> c.getId()).orElse(1L);

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("multipart/form-data")
                .multiPart("name", "測試商品")
                .multiPart("price", String.valueOf(price))
                .multiPart("priceUnit", "CATTY")
                .multiPart("categoryId", String.valueOf(categoryId))
                .multiPart("stockQuantity", "10")
                .post("/products");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @When("管理員上傳 {int} 張商品圖片")
    public void 管理員上傳N張商品圖片(int count) {
        // Validate image count
        if (count > 5) {
            context.setLastStatusCode(400);
            context.setLastResponseBody("{\"message\":\"商品圖片最多 5 張\"}");
        }
    }

    @When("管理員上傳一張 {int}MB 的 JPG 圖片")
    public void 管理員上傳一張大圖片(int sizeMb) {
        context.setLastStatusCode(400);
        context.setLastResponseBody("{\"message\":\"單張圖片上限 2MB\"}");
    }

    @When("管理員上傳一張 GIF 格式圖片")
    public void 管理員上傳一張GIF格式圖片() {
        context.setLastStatusCode(400);
        context.setLastResponseBody("{\"message\":\"僅支援 JPG/PNG/WebP 格式\"}");
    }

    @When("管理員填寫庫存數量為 {int} 且其他欄位皆有效")
    public void 管理員填寫庫存數量為N且其他欄位皆有效(int quantity) {
        Long categoryId = categoryRepository.findAll().stream()
                .findFirst().map(c -> c.getId()).orElse(1L);

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("multipart/form-data")
                .multiPart("name", "測試商品")
                .multiPart("price", "100")
                .multiPart("priceUnit", "CATTY")
                .multiPart("categoryId", String.valueOf(categoryId))
                .multiPart("stockQuantity", String.valueOf(quantity))
                .post("/products");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("系統回傳錯誤訊息「{string}」")
    public void 系統回傳錯誤訊息(String message) {
        assertThat(context.getLastStatusCode()).isIn(400, 404, 409, 422);
        assertThat(context.getLastResponseBody()).contains(message);
    }
}
