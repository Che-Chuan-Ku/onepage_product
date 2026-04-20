package com.onepage.product.dto.inventory;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateLowStockThresholdRequest {

    @NotNull
    @Min(0)
    private Integer threshold;
}
