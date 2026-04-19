package com.onepage.product.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryDTO {

    private Long productId;
    private String productName;
    private String productSlug;
    private int stockQuantity;
    private int lowStockThreshold;
    private boolean lowStockAlerted;
}
