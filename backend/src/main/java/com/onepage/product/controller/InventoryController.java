package com.onepage.product.controller;

import com.onepage.product.dto.inventory.InventoryDTO;
import com.onepage.product.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
            @RequestBody Map<String, Integer> body) {
        return ResponseEntity.ok(inventoryService.updateInventory(productId, body.get("stockQuantity")));
    }

    @PutMapping("/{productId}/threshold")
    public ResponseEntity<InventoryDTO> updateLowStockThreshold(
            @PathVariable Long productId,
            @RequestBody Map<String, Integer> body) {
        return ResponseEntity.ok(inventoryService.updateLowStockThreshold(productId, body.get("threshold")));
    }
}
