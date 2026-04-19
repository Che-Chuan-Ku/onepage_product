package com.onepage.product.controller;

import com.onepage.product.dto.product.*;
import com.onepage.product.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<PagedProducts> listProducts(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(productService.listProducts(status, categoryId, page, size));
    }

    @PostMapping
    public ResponseEntity<ProductDTO> createProduct(
            @Valid @ModelAttribute CreateProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.createProduct(request));
    }

    @GetMapping("/{productId}")
    public ResponseEntity<ProductDTO> getProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(productService.getProduct(productId));
    }

    @PutMapping("/{productId}")
    public ResponseEntity<ProductDTO> updateProduct(
            @PathVariable Long productId,
            @Valid @ModelAttribute UpdateProductRequest request) {
        return ResponseEntity.ok(productService.updateProduct(productId, request));
    }

    @PostMapping("/{productId}/deactivate")
    public ResponseEntity<ProductDTO> deactivateProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(productService.deactivateProduct(productId));
    }

    // REQ-026: 商品圖片上傳
    @PostMapping("/{productId}/images")
    public ResponseEntity<List<ProductImageDTO>> uploadProductImages(
            @PathVariable Long productId,
            @RequestParam("images") List<MultipartFile> images) {
        return ResponseEntity.ok(productService.uploadProductImages(productId, images));
    }
}
