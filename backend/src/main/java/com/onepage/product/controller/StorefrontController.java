package com.onepage.product.controller;

import com.onepage.product.dto.shipping.ShippingCalculateRequest;
import com.onepage.product.dto.shipping.ShippingCalculateResponse;
import com.onepage.product.dto.storefront.StorefrontProductDTO;
import com.onepage.product.dto.storefront.StorefrontWebsiteDTO;
import com.onepage.product.service.StorefrontService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/storefront")
@RequiredArgsConstructor
public class StorefrontController {

    private final StorefrontService storefrontService;

    @GetMapping("/websites/{websiteId}")
    public ResponseEntity<StorefrontWebsiteDTO> getStorefrontWebsite(@PathVariable Long websiteId) {
        return ResponseEntity.ok(storefrontService.getStorefrontWebsite(websiteId));
    }

    @GetMapping("/websites/{websiteId}/products/{productSlug}")
    public ResponseEntity<StorefrontProductDTO> getStorefrontProduct(
            @PathVariable Long websiteId,
            @PathVariable String productSlug) {
        return ResponseEntity.ok(storefrontService.getStorefrontProduct(websiteId, productSlug));
    }

    @GetMapping("/products/{productId}/stock-check")
    public ResponseEntity<Map<String, Boolean>> checkProductStock(
            @PathVariable Long productId,
            @RequestParam int quantity) {
        boolean available = storefrontService.checkProductStock(productId, quantity);
        return ResponseEntity.ok(Map.of("available", available));
    }

    @PostMapping("/shipping/calculate")
    public ResponseEntity<ShippingCalculateResponse> calculateShipping(
            @Valid @RequestBody ShippingCalculateRequest request) {
        return ResponseEntity.ok(storefrontService.calculateShipping(request));
    }
}
