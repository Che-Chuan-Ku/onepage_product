package com.onepage.product.dto.product;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BundleItemDTO {

    private Long productId;
    private String productName;
    private BigDecimal price;
}
