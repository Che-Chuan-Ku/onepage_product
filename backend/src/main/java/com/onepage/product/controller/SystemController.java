package com.onepage.product.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

@RestController
@RequestMapping("/system")
public class SystemController {

    @GetMapping("/time")
    public ResponseEntity<Map<String, Object>> getServerTime() {
        return ResponseEntity.ok(Map.of("serverTime", OffsetDateTime.now().toString()));
    }
}
