package com.onepage.product.controller;

import com.onepage.product.dto.website.*;
import com.onepage.product.service.WebsiteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/websites")
@RequiredArgsConstructor
public class WebsiteController {

    private final WebsiteService websiteService;

    @GetMapping
    public ResponseEntity<List<WebsiteDTO>> listWebsites() {
        return ResponseEntity.ok(websiteService.listWebsites());
    }

    @PostMapping
    public ResponseEntity<WebsiteDTO> createWebsite(@Valid @ModelAttribute CreateWebsiteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(websiteService.createWebsite(request));
    }

    @GetMapping("/{websiteId}")
    public ResponseEntity<WebsiteDTO> getWebsite(@PathVariable Long websiteId) {
        return ResponseEntity.ok(websiteService.getWebsite(websiteId));
    }

    @PutMapping("/{websiteId}")
    public ResponseEntity<WebsiteDTO> updateWebsite(
            @PathVariable Long websiteId,
            @Valid @ModelAttribute UpdateWebsiteRequest request) {
        return ResponseEntity.ok(websiteService.updateWebsite(websiteId, request));
    }

    @PostMapping("/{websiteId}/publish")
    public ResponseEntity<WebsiteDTO> publishWebsite(@PathVariable Long websiteId) {
        return ResponseEntity.ok(websiteService.publishWebsite(websiteId));
    }

    @PostMapping("/{websiteId}/unpublish")
    public ResponseEntity<WebsiteDTO> unpublishWebsite(@PathVariable Long websiteId) {
        return ResponseEntity.ok(websiteService.unpublishWebsite(websiteId));
    }

    // REQ-028: 重新上線（已下線 → 已上線）
    @PostMapping("/{websiteId}/republish")
    public ResponseEntity<WebsiteDTO> republishWebsite(@PathVariable Long websiteId) {
        return ResponseEntity.ok(websiteService.republishWebsite(websiteId));
    }

    @GetMapping("/{websiteId}/products")
    public ResponseEntity<List<WebsiteProductDTO>> listWebsiteProducts(@PathVariable Long websiteId) {
        return ResponseEntity.ok(websiteService.listWebsiteProducts(websiteId));
    }

    @PutMapping("/{websiteId}/products")
    public ResponseEntity<List<WebsiteProductDTO>> updateWebsiteProducts(
            @PathVariable Long websiteId,
            @Valid @RequestBody List<WebsiteProductInput> inputs) {
        return ResponseEntity.ok(websiteService.updateWebsiteProducts(websiteId, inputs));
    }
}
