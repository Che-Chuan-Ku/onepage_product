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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class PaymentSteps {

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

    @Given("有一筆「待付款」的訂單")
    public void 有一筆待付款的訂單() {
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
        Website website = websiteRepository.findAll().stream().findFirst()
                .orElseGet(() -> websiteRepository.save(Website.builder()
                        .ownerUser(adminUser)
                        .name("測試網站")
                        .title("測試網站")
                        .status(Website.WebsiteStatus.PUBLISHED)
                        .freeShippingThreshold(new BigDecimal("1500.00"))
                        .build()));

        Order order = Order.builder()
                .orderNumber("ORD-TEST-001")
                .website(website)
                .customerName("王小明")
                .customerPhone("0912345678")
                .customerEmail("customer@example.com")
                .shippingMethod(Order.ShippingMethod.DELIVERY)
                .shippingFee(new BigDecimal("150"))
                .subtotal(new BigDecimal("1000"))
                .totalAmount(new BigDecimal("1150"))
                .status(Order.OrderStatus.PENDING_PAYMENT)
                .build();
        order = orderRepository.save(order);
        context.setId("orderId", order.getId());
    }

    @When("顧客選擇信用卡付款")
    public void 顧客選擇信用卡付款() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .contentType("application/json")
                .body(Map.of("paymentMethod", "CREDIT_CARD"))
                .post("/storefront/orders/" + context.getId("orderId") + "/payment");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("付款建立成功並回傳綠界付款頁面 URL")
    public void 付款建立成功並回傳綠界付款頁面URL() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(201);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.has("ecpayPaymentUrl")).isTrue();
        assertThat(json.get("ecpayPaymentUrl").asText()).isNotBlank();
    }

    @Given("有一筆「已付款」的訂單")
    public void 有一筆已付款的訂單() {
        有一筆待付款的訂單();
        orderRepository.findById(context.getId("orderId")).ifPresent(order -> {
            order.setStatus(Order.OrderStatus.PAID);
            orderRepository.save(order);
        });
    }

    @When("綠界發送付款成功回調")
    public void 綠界發送付款成功回調() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .contentType("application/x-www-form-urlencoded")
                .formParam("RtnCode", "1")
                .formParam("TradeNo", "ECPAY123456")
                .formParam("MerchantTradeNo", "ORD-TEST-001")
                .post("/payment/ecpay/callback");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("訂單狀態更新為「已付款」")
    public void 訂單狀態更新為已付款() {
        orderRepository.findById(context.getId("orderId")).ifPresent(order ->
            assertThat(order.getStatus()).isEqualTo(Order.OrderStatus.PAID));
    }

    @Then("回傳 {string}")
    public void 回傳字串(String expected) {
        assertThat(lastResponse.getBody().asString()).contains(expected);
    }
}
