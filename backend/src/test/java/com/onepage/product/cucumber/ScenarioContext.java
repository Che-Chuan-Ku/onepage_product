package com.onepage.product.cucumber;

import io.cucumber.spring.ScenarioScope;
import lombok.Data;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@ScenarioScope
@Data
public class ScenarioContext {

    private String accessToken;
    private String refreshToken;
    private Map<String, Long> ids = new HashMap<>();
    private Map<String, String> strings = new HashMap<>();
    private Map<String, Object> lastResponse = new HashMap<>();
    private int lastStatusCode;
    private String lastResponseBody;

    public void setId(String key, Long id) {
        ids.put(key, id);
    }

    public Long getId(String key) {
        return ids.get(key);
    }

    public void setString(String key, String value) {
        strings.put(key, value);
    }

    public String getString(String key) {
        return strings.get(key);
    }

    public void setLastResponseBody(String body) {
        this.lastResponseBody = body;
    }
}
