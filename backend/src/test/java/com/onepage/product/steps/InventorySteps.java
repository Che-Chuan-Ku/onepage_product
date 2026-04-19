package com.onepage.product.steps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.onepage.product.cucumber.ScenarioContext;
import com.onepage.product.model.Product;
import com.onepage.product.model.ProductCategory;
import com.onepage.product.model.User;
import com.onepage.product.repository.ProductCategoryRepository;
import com.onepage.product.repository.ProductRepository;
import com.onepage.product.repository.UserRepository;
import io.cucumber.java.en.*;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class InventorySteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductCategoryRepository categoryRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @LocalServerPort
    private int port;

    private Response lastResponse;

    @Given("系統中有商品 {string} 庫存為 {int}")
    public void 系統中有商品庫存為(String productName, int stock) {
        User adminUser = userRepository.findByEmail("admin@example.com")
                .orElseGet(() -> {
                    User u = User.builder()
                            .email("admin@example.com")
                            .passwordHash("$2b$10$AjJoi3VI1xXqwgiaLDWSA.PHuAtiXMykJOS9B7olGgQYRawiBmkC2")
                            .name("系統管理員")
                            .role(User.UserRole.ADMIN)
                            .build();
                    return userRepository.save(u);
                });
        ProductCategory cat = categoryRepository.findAll().stream().findFirst()
                .orElseGet(() -> {
                    ProductCategory c = new ProductCategory();
                    c.setOwnerUser(adminUser);
                    c.setName("水果類");
                    return categoryRepository.save(c);
                });

        Product product = productRepository.findAll().stream()
                .filter(p -> p.getName().equals(productName))
                .findFirst()
                .orElseGet(() -> Product.builder()
                        .ownerUser(adminUser)
                        .name(productName)
                        .slug(productName + "-inv-" + System.currentTimeMillis())
                        .price(new BigDecimal("100"))
                        .priceUnit(Product.PriceUnit.CATTY)
                        .category(cat)
                        .stockQuantity(stock)
                        .status(Product.ProductStatus.ACTIVE)
                        .build());
        product.setStockQuantity(stock);
        product = productRepository.save(product);
        context.setId("productId", product.getId());
    }

    @When("管理員將庫存更新為 {int}")
    public void 管理員將庫存更新為(int quantity) {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("application/json")
                .body(Map.of("stockQuantity", quantity))
                .put("/inventory/" + context.getId("productId"));
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("庫存更新成功，數量為 {int}")
    public void 庫存更新成功數量為(int quantity) throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("stockQuantity").asInt()).isEqualTo(quantity);
    }

    @When("管理員設定低庫存門檻為 {int}")
    public void 管理員設定低庫存門檻為(int threshold) {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("application/json")
                .body(Map.of("threshold", threshold))
                .put("/inventory/" + context.getId("productId") + "/threshold");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("低庫存門檻更新成功，門檻為 {int}")
    public void 低庫存門檻更新成功門檻為(int threshold) throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("lowStockThreshold").asInt()).isEqualTo(threshold);
    }

    @When("管理員查詢庫存清單")
    public void 管理員查詢庫存清單() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .get("/inventory");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("回傳庫存清單")
    public void 回傳庫存清單() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        assertThat(lastResponse.getBody().asString()).contains("[");
    }
}
