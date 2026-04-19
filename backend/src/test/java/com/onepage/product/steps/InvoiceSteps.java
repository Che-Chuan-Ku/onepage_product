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
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class InvoiceSteps {

    @Autowired
    private ScenarioContext context;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private WebsiteRepository websiteRepository;

    @Autowired
    private com.onepage.product.repository.UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @LocalServerPort
    private int port;

    private Response lastResponse;

    @Given("有一張狀態為「已開立」的當月發票")
    public void 有一張狀態為已開立的當月發票() {
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
        Website website = websiteRepository.findAll().stream().findFirst()
                .orElseGet(() -> websiteRepository.save(Website.builder()
                        .ownerUser(adminUser)
                        .name("測試網站")
                        .title("測試網站")
                        .status(Website.WebsiteStatus.PUBLISHED)
                        .freeShippingThreshold(new BigDecimal("1500.00"))
                        .build()));

        Order order = Order.builder()
                .orderNumber("ORD-INV-TEST-" + System.currentTimeMillis())
                .website(website)
                .customerName("王小明")
                .customerPhone("0912345678")
                .customerEmail("customer@example.com")
                .shippingMethod(Order.ShippingMethod.DELIVERY)
                .shippingFee(BigDecimal.ZERO)
                .subtotal(new BigDecimal("1000"))
                .totalAmount(new BigDecimal("1000"))
                .status(Order.OrderStatus.PAID)
                .build();
        order = orderRepository.save(order);

        Invoice invoice = Invoice.builder()
                .order(order)
                .invoiceNumber("AA12345678")
                .invoiceDate(LocalDate.now())
                .amount(new BigDecimal("1000"))
                .invoiceType(Invoice.InvoiceType.TWO_COPIES)
                .status(Invoice.InvoiceStatus.ISSUED)
                .build();
        invoice = invoiceRepository.save(invoice);
        context.setId("invoiceId", invoice.getId());
    }

    @Given("有一張狀態為「已開立」的發票")
    public void 有一張狀態為已開立的發票() {
        有一張狀態為已開立的當月發票();
    }

    @When("管理員作廢發票，原因為 {string}")
    public void 管理員作廢發票原因為(String reason) {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("application/json")
                .body(Map.of("reason", reason))
                .post("/invoices/" + context.getId("invoiceId") + "/void");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("發票狀態更新為「已作廢」")
    public void 發票狀態更新為已作廢() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("status").asText()).isEqualTo("VOIDED");
    }

    @When("管理員折讓發票金額 {int}")
    public void 管理員折讓發票金額(int amount) {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .contentType("application/json")
                .body(Map.of("amount", amount))
                .post("/invoices/" + context.getId("invoiceId") + "/allowance");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("發票狀態更新為「已折讓」")
    public void 發票狀態更新為已折讓() throws Exception {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(lastResponse.getBody().asString());
        assertThat(json.get("status").asText()).isEqualTo("ALLOWANCED");
    }

    @When("管理員查詢發票清單")
    public void 管理員查詢發票清單() {
        lastResponse = RestAssured.given()
                .baseUri("http://localhost:" + port)
                .basePath("/api/v1")
                .header("Authorization", "Bearer " + context.getAccessToken())
                .get("/invoices");
        context.setLastStatusCode(lastResponse.getStatusCode());
        context.setLastResponseBody(lastResponse.getBody().asString());
    }

    @Then("回傳發票清單")
    public void 回傳發票清單() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(200);
    }
}
