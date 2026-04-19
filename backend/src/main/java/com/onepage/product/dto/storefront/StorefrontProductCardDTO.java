package com.onepage.product.dto.storefront;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorefrontProductCardDTO {

    private Long id;
    private String name;
    private String slug;
    private BigDecimal price;
    private String imageUrl;
    private boolean isPreorder;
    private BigDecimal preorderDiscountPercent;
}
