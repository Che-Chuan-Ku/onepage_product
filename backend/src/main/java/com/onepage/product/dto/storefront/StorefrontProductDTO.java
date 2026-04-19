package com.onepage.product.dto.storefront;

import com.onepage.product.dto.product.BundleItemDTO;
import com.onepage.product.dto.product.ProductImageDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorefrontProductDTO {

    private Long id;
    private String name;
    private String slug;
    private String description;
    private BigDecimal price;
    private String priceUnit;
    private String packaging;
    private String categoryName;
    private boolean isBundle;
    private BigDecimal bundleDiscountPercent;
    private List<BundleItemDTO> bundleItems;
    private boolean isPreorder;
    private LocalDate preorderEndDate;
    private BigDecimal preorderDiscountPercent;
    private int stockQuantity;
    private List<ProductImageDTO> images;
}
