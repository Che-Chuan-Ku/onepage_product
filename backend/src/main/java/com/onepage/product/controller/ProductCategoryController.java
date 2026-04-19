package com.onepage.product.controller;

import com.onepage.product.dto.product.CreateProductCategoryRequest;
import com.onepage.product.dto.product.ProductCategoryDTO;
import com.onepage.product.service.ProductCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/product-categories")
@RequiredArgsConstructor
public class ProductCategoryController {

    private final ProductCategoryService categoryService;

    @GetMapping
    public ResponseEntity<List<ProductCategoryDTO>> listCategories() {
        return ResponseEntity.ok(categoryService.listCategories());
    }

    @PostMapping
    public ResponseEntity<ProductCategoryDTO> createCategory(
            @Valid @RequestBody CreateProductCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.createCategory(request));
    }

    @PutMapping("/{categoryId}")
    public ResponseEntity<ProductCategoryDTO> updateCategory(
            @PathVariable Long categoryId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(categoryService.updateCategory(categoryId, body.get("name")));
    }

    @DeleteMapping("/{categoryId}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long categoryId) {
        categoryService.deleteCategory(categoryId);
        return ResponseEntity.noContent().build();
    }
}
