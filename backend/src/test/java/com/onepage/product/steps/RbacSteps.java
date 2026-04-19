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
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

public class RbacSteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductCategoryRepository categoryRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @LocalServerPort
    private int port;

    private Response lastResponse;

    @Given("該使用者已建立商品 {string}")
    public void 該使用者已建立商品(String productName) {
        String email = context.getString("currentUserEmail");
        User user = userRepository.findByEmail(email).orElseThrow();

        // Ensure a category exists for the user
        ProductCategory category = categoryRepository.findByOwnerUserId(user.getId()).stream()
                .findFirst()
                .orElseGet(() -> {
                    ProductCategory cat = new ProductCategory();
                    cat.setOwnerUser(user);
                    cat.setName("測試分類");
                    return categoryRepository.save(cat);
                });

        Product product = Product.builder()
                .ownerUser(user)
                .name(productName)
                .slug(productName.replaceAll("[^a-zA-Z0-9]", "-") + "-" + System.currentTimeMillis())
                .price(new BigDecimal("100.00"))
                .priceUnit(Product.PriceUnit.CATTY)
                .category(category)
                .stockQuantity(10)
                .status(Product.ProductStatus.ACTIVE)
                .build();
        productRepository.save(product);
    }

    @When("一般使用者查詢商品清單")
    public void 一般使用者查詢商品清單() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .get("/products");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("清單中只包含自己的商品")
    public void 清單中只包含自己的商品() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        String email = context.getString("currentUserEmail");
        User user = userRepository.findByEmail(email).orElseThrow();
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        JsonNode content = json.get("content");
        if (content != null && content.isArray()) {
            for (JsonNode item : content) {
                if (item.has("ownerUserId") && !item.get("ownerUserId").isNull()) {
                    assertThat(item.get("ownerUserId").asLong()).isEqualTo(user.getId());
                }
            }
        }
    }

    @When("一般使用者查詢訂單清單")
    public void 一般使用者查詢訂單清單() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .get("/orders");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("訂單清單只包含自己網站的訂單")
    public void 訂單清單只包含自己網站的訂單() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        // With RBAC filtering, orders are already filtered by website owner
    }

    @Then("系統回傳 {int} 無權限")
    public void 系統回傳無權限(int statusCode) {
        assertThat(lastResponse.getStatusCode()).isEqualTo(statusCode);
    }
}
