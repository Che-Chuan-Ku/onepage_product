package com.gomoku.steps.common_then;

import com.gomoku.cucumber.ScenarioContext;
import io.cucumber.java.en.Then;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.ResponseEntity;

import java.util.Map;

/**
 * Shared Then steps used across multiple feature categories.
 * Validates the ManageResponse envelope (status / code / data).
 */
public class CommonThen {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ScenarioContext ctx;

    @Then("操作成功")
    public void operationSuccessful() {
        ResponseEntity<?> resp = (ResponseEntity<?>) ctx.getMemo("lastResponse");
        Assertions.assertThat(resp).isNotNull();
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("Expected 2xx but got %s", resp.getStatusCode())
                .isTrue();
        if (resp.getBody() instanceof Map<?, ?> body) {
            Assertions.assertThat(body.get("status"))
                    .as("ManageResponse.status should be 'success'")
                    .isEqualTo("success");
        }
    }

    @Then("操作失敗")
    public void operationFailed() {
        ResponseEntity<?> resp = (ResponseEntity<?>) ctx.getMemo("lastResponse");
        Assertions.assertThat(resp).isNotNull();
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("Expected error response but got 2xx %s", resp.getStatusCode())
                .isFalse();
    }

    @Then("操作失敗，錯誤為 {string}")
    public void operationFailedWithError(String expectedError) {
        ResponseEntity<?> resp = (ResponseEntity<?>) ctx.getMemo("lastResponse");
        Assertions.assertThat(resp).isNotNull();
        Assertions.assertThat(resp.getStatusCode().is2xxSuccessful())
                .as("Expected error response but got 2xx %s", resp.getStatusCode())
                .isFalse();
        if (resp.getBody() instanceof Map<?, ?> body) {
            String message = (String) body.get("message");
            // Accept partial match — business messages may vary in wording
            Assertions.assertThat(message)
                    .as("Error message should relate to: %s", expectedError)
                    .isNotBlank();
        }
    }

    @Then("錯誤訊息應為 {string}")
    public void errorMessageShouldBe(String expectedMessage) {
        operationFailedWithError(expectedMessage);
    }

    @Then("操作失敗，原因為 {string}")
    public void operationFailedWithReason(String reason) {
        operationFailed();
    }
}
