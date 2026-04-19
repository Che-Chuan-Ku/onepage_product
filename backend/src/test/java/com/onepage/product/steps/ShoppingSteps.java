package com.onepage.product.steps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.onepage.product.cucumber.ScenarioContext;
import com.onepage.product.model.*;
import com.onepage.product.repository.*;
import io.cucumber.java.en.*;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

public class ShoppingSteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private WebsiteRepository websiteRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WebsiteProductRepository websiteProductRepository;

    @Autowired
    private ProductCategoryRepository categoryRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @LocalServerPort
    private int port;

    private Response lastResponse;

    @Given("顧客瀏覽已上線的網站")
    public void 顧客瀏覽已上線的網站() {
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
        Website website = websiteRepository.findByStatus(Website.WebsiteStatus.PUBLISHED).stream()
                .findFirst()
                .orElseGet(() -> websiteRepository.save(Website.builder()
                        .ownerUser(adminUser)
                        .name("上線網站")
                        .title("上線網站")
                        .status(Website.WebsiteStatus.PUBLISHED)
                        .freeShippingThreshold(new BigDecimal("1500.00"))
                        .build()));
        context.setId("websiteId", website.getId());
    }

    @When("顧客查看商品集合頁")
    public void 顧客查看商品集合頁() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .get("/storefront/websites/" + context.getId("websiteId"));
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("回傳網站資訊與商品列表")
    public void 回傳網站資訊與商品列表() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.has("products")).isTrue();
    }

    @Given("網站上有商品 {string}")
    public void 網站上有商品(String productName) {
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

        Website website = websiteRepository.findById(context.getId("websiteId"))
                .orElseThrow();

        Product product = productRepository.findAll().stream()
                .filter(p -> p.getName().equals(productName))
                .findFirst()
                .orElseGet(() -> productRepository.save(Product.builder()
                        .ownerUser(adminUser)
                        .name(productName)
                        .slug(productName + "-shop-" + System.currentTimeMillis())
                        .price(new BigDecimal("280"))
                        .priceUnit(Product.PriceUnit.KG)
                        .category(cat)
                        .stockQuantity(100)
                        .status(Product.ProductStatus.ACTIVE)
                        .build()));
        context.setId("productId", product.getId());

        if (!websiteProductRepository.existsByWebsiteIdAndProductId(website.getId(), product.getId())) {
            websiteProductRepository.save(WebsiteProduct.builder()
                    .website(website)
                    .product(product)
                    .publishAt(java.time.LocalDateTime.now())
                    .build());
        }
    }

    @When("顧客查看商品 {string} 詳情頁")
    public void 顧客查看商品詳情頁(String productName) {
        Product product = productRepository.findAll().stream()
                .filter(p -> p.getName().equals(productName))
                .findFirst()
                .orElseThrow();

        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .get("/storefront/websites/" + context.getId("websiteId")
                        + "/products/" + product.getSlug());
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("回傳商品詳細資訊")
    public void 回傳商品詳細資訊() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.has("name")).isTrue();
        assertThat(json.has("price")).isTrue();
    }

    @Given("商品 {string} 庫存為 {int}")
    public void 商品庫存為(String productName, int stock) {
        productRepository.findAll().stream()
                .filter(p -> p.getName().equals(productName))
                .findFirst()
                .ifPresent(p -> {
                    p.setStockQuantity(stock);
                    productRepository.save(p);
                    context.setId("productId", p.getId());
                });
    }

    @When("顧客查詢庫存是否足夠 {int} 份")
    public void 顧客查詢庫存是否足夠(int quantity) {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .get("/storefront/products/" + context.getId("productId")
                        + "/stock-check?quantity=" + quantity);
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("回傳庫存充足")
    public void 回傳庫存充足() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("available").asBoolean()).isTrue();
    }

    @Then("回傳庫存不足")
    public void 回傳庫存不足() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("available").asBoolean()).isFalse();
    }
}
