package com.onepage.product.controller;

import com.onepage.product.dto.inventory.InventoryDTO;
import com.onepage.product.dto.inventory.UpdateInventoryRequest;
import com.onepage.product.dto.inventory.UpdateLowStockThresholdRequest;
import com.onepage.product.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping
    public ResponseEntity<List<InventoryDTO>> listInventory() {
        return ResponseEntity.ok(inventoryService.listInventory());
    }

    @PutMapping("/{productId}")
    public ResponseEntity<InventoryDTO> updateInventory(
            @PathVariable Long productId,
            @Valid @RequestBody UpdateInventoryRequest request) {
        return ResponseEntity.ok(inventoryService.updateInventory(productId, request.getStockQuantity()));
    }

    @PutMapping("/{productId}/threshold")
    public ResponseEntity<InventoryDTO> updateLowStockThreshold(
            @PathVariable Long productId,
            @Valid @RequestBody UpdateLowStockThresholdRequest request) {
        return ResponseEntity.ok(inventoryService.updateLowStockThreshold(productId, request.getThreshold()));
    }
}
