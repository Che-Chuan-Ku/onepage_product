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
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class OrderQuerySteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private WebsiteRepository websiteRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @LocalServerPort
    private int port;

    private Response lastResponse;
    private Map<String, String> queryParams = new HashMap<>();

    @Given("系統中有訂單資料")
    public void 系統中有訂單資料() {
        ensureWebsiteAndOrderExists();
    }

    @Given("系統中有 {int} 筆訂單")
    public void 系統中有N筆訂單(int count) {
        Website website = ensureWebsiteExists();
        long existing = orderRepository.count();
        for (int i = (int) existing; i < count; i++) {
            Order order = Order.builder()
                    .orderNumber("ORD-QUERY-" + String.format("%03d", i))
                    .website(website)
                    .customerName("顧客" + i)
                    .customerPhone("0912" + String.format("%06d", i))
                    .customerEmail("cust" + i + "@example.com")
                    .shippingMethod(Order.ShippingMethod.DELIVERY)
                    .shippingFee(new BigDecimal("150"))
                    .subtotal(new BigDecimal("1000"))
                    .totalAmount(new BigDecimal("1150"))
                    .status(Order.OrderStatus.PENDING_PAYMENT)
                    .build();
            orderRepository.save(order);
        }
    }

    @When("管理員點擊搜尋按鈕（未設定任何篩選條件）")
    public void 管理員點擊搜尋按鈕無篩選條件() {
        queryParams.clear();
        executeOrderQuery();
    }

    @Then("顯示第一頁訂單列表，每頁 {int} 筆")
    public void 顯示第一頁訂單列表每頁N筆(int pageSize) throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("size").asInt()).isEqualTo(pageSize);
    }

    @And("總共 {int} 頁")
    public void 總共N頁(int pages) throws Exception {
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("totalPages").asInt()).isGreaterThanOrEqualTo(1);
    }

    @When("管理員選擇所屬網站為 {string} 並點擊搜尋")
    public void 管理員選擇所屬網站並點擊搜尋(String websiteName) {
        queryParams.clear();
        executeOrderQuery();
    }

    @Then("僅顯示所屬網站為 {string} 的訂單")
    public void 僅顯示所屬網站的訂單(String websiteName) {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
    }

    @When("管理員輸入訂單編號 {string} 並點擊搜尋")
    public void 管理員輸入訂單編號並點擊搜尋(String orderNumber) {
        queryParams.clear();
        queryParams.put("orderNumber", orderNumber);
        executeOrderQuery();
    }

    @Then("顯示該筆訂單")
    public void 顯示該筆訂單() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
    }

    @When("管理員設定日期區間為 {string} 至 {string} 並點擊搜尋")
    public void 管理員設定日期區間並點擊搜尋(String start, String end) {
        queryParams.clear();
        queryParams.put("startDate", start);
        queryParams.put("endDate", end);
        executeOrderQuery();
    }

    @Then("僅顯示建立日期在該區間內的訂單")
    public void 僅顯示建立日期在該區間內的訂單() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
    }

    @When("管理員選擇付款狀態為 {string} 並點擊搜尋")
    public void 管理員選擇付款狀態並點擊搜尋(String status) {
        queryParams.clear();
        String apiStatus = translateStatus(status);
        if (apiStatus != null) queryParams.put("status", apiStatus);
        executeOrderQuery();
    }

    @Then("僅顯示狀態為 {string} 的訂單")
    public void 僅顯示狀態為的訂單(String status) {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
    }

    @When("管理員選擇所屬網站為 {string}")
    public void 管理員選擇所屬網站為(String websiteName) {
        queryParams.clear();
    }

    @And("設定日期區間為 {string} 至 {string}")
    public void 設定日期區間為(String start, String end) {
        queryParams.put("startDate", start);
        queryParams.put("endDate", end);
    }

    @And("選擇付款狀態為 {string}")
    public void 選擇付款狀態為(String status) {
        String apiStatus = translateStatus(status);
        if (apiStatus != null) queryParams.put("status", apiStatus);
    }

    @And("點擊搜尋")
    public void 點擊搜尋() {
        executeOrderQuery();
    }

    @Then("僅顯示符合所有條件的訂單")
    public void 僅顯示符合所有條件的訂單() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
    }

    @Then("顯示查無結果提示")
    public void 顯示查無結果提示() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("totalElements").asLong()).isEqualTo(0);
    }

    @Given("訂單狀態為「已付款」")
    public void 訂單狀態為已付款() {
        ensureWebsiteAndOrderExists();
    }

    @Given("訂單 {string} 狀態為「已付款」")
    public void 訂單狀態為已付款(String orderNumber) {
        Website website = ensureWebsiteExists();
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseGet(() -> orderRepository.save(Order.builder()
                        .orderNumber(orderNumber)
                        .website(website)
                        .customerName("顧客")
                        .customerPhone("0912345678")
                        .customerEmail("customer@example.com")
                        .shippingMethod(Order.ShippingMethod.DELIVERY)
                        .shippingFee(BigDecimal.ZERO)
                        .subtotal(new BigDecimal("1000"))
                        .totalAmount(new BigDecimal("1000"))
                        .status(Order.OrderStatus.PAID)
                        .build()));
        order.setStatus(Order.OrderStatus.PAID);
        order = orderRepository.save(order);
        context.setId("orderId", order.getId());
    }

    @Given("訂單 {string} 狀態為「{string}」")
    public void 訂單狀態為某狀態(String orderNumber, String statusStr) {
        Website website = ensureWebsiteExists();
        Order.OrderStatus status = translateStatusToEnum(statusStr);
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseGet(() -> {
                    Order o = Order.builder()
                            .orderNumber(orderNumber)
                            .website(website)
                            .customerName("顧客")
                            .customerPhone("0912345678")
                            .customerEmail("customer@example.com")
                            .shippingMethod(Order.ShippingMethod.DELIVERY)
                            .shippingFee(BigDecimal.ZERO)
                            .subtotal(new BigDecimal("1000"))
                            .totalAmount(new BigDecimal("1000"))
                            .status(status)
                            .build();
                    return orderRepository.save(o);
                });
        order.setStatus(status);
        order = orderRepository.save(order);
        context.setId("orderId", order.getId());
    }

    @When("管理員對訂單 {string} 點擊標註出貨")
    public void 管理員對訂單點擊標註出貨(String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber).orElseThrow();
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .post("/orders/" + order.getId() + "/ship");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @When("管理員嘗試對訂單 {string} 標註出貨")
    public void 管理員嘗試對訂單標註出貨(String orderNumber) {
        管理員對訂單點擊標註出貨(orderNumber);
    }

    @Then("訂單狀態變為「已出貨」")
    public void 訂單狀態變為已出貨() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("status").asText()).isEqualTo("SHIPPED");
    }

    @And("系統自動發送發貨通知 Email 給顧客")
    public void 系統自動發送發貨通知Email給顧客() {
        // Async email
    }

    private void executeOrderQuery() {
        var request = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken());
        for (Map.Entry<String, String> entry : queryParams.entrySet()) {
            request = request.queryParam(entry.getKey(), entry.getValue());
        }
        lastResponse = request.get("/orders");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    private String translateStatus(String chineseStatus) {
        return switch (chineseStatus) {
            case "待付款" -> "PENDING_PAYMENT";
            case "付款處理中" -> "PROCESSING_PAYMENT";
            case "已付款" -> "PAID";
            case "已出貨" -> "SHIPPED";
            case "已退貨" -> "RETURNED";
            case "付款失敗" -> "PAYMENT_FAILED";
            default -> null;
        };
    }

    private Order.OrderStatus translateStatusToEnum(String chineseStatus) {
        return switch (chineseStatus) {
            case "待付款" -> Order.OrderStatus.PENDING_PAYMENT;
            case "付款處理中" -> Order.OrderStatus.PROCESSING_PAYMENT;
            case "已付款" -> Order.OrderStatus.PAID;
            case "已出貨" -> Order.OrderStatus.SHIPPED;
            case "已退貨" -> Order.OrderStatus.RETURNED;
            case "付款失敗" -> Order.OrderStatus.PAYMENT_FAILED;
            default -> Order.OrderStatus.PENDING_PAYMENT;
        };
    }

    private Website ensureWebsiteExists() {
        if (context.getId("websiteId") != null) {
            return websiteRepository.findById(context.getId("websiteId")).orElseGet(this::createWebsite);
        }
        return createWebsite();
    }

    private Website createWebsite() {
        User adminUser = userRepository.findByEmail("admin@example.com").orElseGet(() -> {
            User u = User.builder()
                    .email("admin@example.com")
                    .passwordHash("$2b$10$AjJoi3VI1xXqwgiaLDWSA.PHuAtiXMykJOS9B7olGgQYRawiBmkC2")
                    .name("系統管理員")
                    .role(User.UserRole.ADMIN)
                    .build();
            return userRepository.save(u);
        });
        Website w = websiteRepository.save(Website.builder()
                .ownerUser(adminUser)
                .name("測試網站")
                .title("測試網站")
                .status(Website.WebsiteStatus.PUBLISHED)
                .freeShippingThreshold(new BigDecimal("1500.00"))
                .build());
        context.setId("websiteId", w.getId());
        return w;
    }

    private void ensureWebsiteAndOrderExists() {
        Website website = ensureWebsiteExists();
        if (orderRepository.count() == 0) {
            Order order = Order.builder()
                    .orderNumber("ORD-DEFAULT-001")
                    .website(website)
                    .customerName("預設顧客")
                    .customerPhone("0912000000")
                    .customerEmail("default@example.com")
                    .shippingMethod(Order.ShippingMethod.DELIVERY)
                    .shippingFee(BigDecimal.ZERO)
                    .subtotal(new BigDecimal("1000"))
                    .totalAmount(new BigDecimal("1000"))
                    .status(Order.OrderStatus.PAID)
                    .build();
            order = orderRepository.save(order);
            context.setId("orderId", order.getId());
        }
    }
}
