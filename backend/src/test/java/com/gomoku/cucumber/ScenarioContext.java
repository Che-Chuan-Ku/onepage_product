package com.gomoku.cucumber;

import io.cucumber.spring.ScenarioScope;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@ScenarioScope
public class ScenarioContext {

    private ResponseEntity<?> lastResponse;
    private final Map<String, Object> ids = new HashMap<>();
    private final Map<String, Object> memo = new HashMap<>();
    private String jwtToken;
    private Object queryResult;
    private String lastError;

    public void clear() {
        ids.clear();
        memo.clear();
        lastResponse = null;
        jwtToken = null;
        queryResult = null;
        lastError = null;
    }

    public void putId(String key, Object value) { ids.put(key, value); }
    public Object getId(String key) { return ids.get(key); }
    public boolean hasId(String key) { return ids.containsKey(key); }

    public void putMemo(String key, Object value) { memo.put(key, value); }
    public Object getMemo(String key) { return memo.get(key); }

    public ResponseEntity<?> getLastResponse() { return lastResponse; }
    public void setLastResponse(ResponseEntity<?> resp) {
        this.lastResponse = resp;
        // Also store in memo so CommonThen can pick it up
        memo.put("lastResponse", resp);
    }

    public String getJwtToken() { return jwtToken; }
    public void setJwtToken(String jwtToken) { this.jwtToken = jwtToken; }

    public Object getQueryResult() { return queryResult; }
    public void setQueryResult(Object queryResult) { this.queryResult = queryResult; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
}
