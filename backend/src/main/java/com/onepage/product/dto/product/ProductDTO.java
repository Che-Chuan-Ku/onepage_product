package com.onepage.product.dto.product;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductDTO {

    private Long id;
    private Long ownerUserId;
    private String name;
    private String slug;
    private String description;
    private BigDecimal price;
    private String priceUnit;
    private String packaging;
    private Long categoryId;
    private String categoryName;
    private String status;
    @JsonProperty("isBundle")
    private boolean isBundle;
    private BigDecimal bundleDiscountPercent;
    private List<BundleItemDTO> bundleItems;
    @JsonProperty("isPreorder")
    private boolean isPreorder;
    private LocalDate preorderStartDate;
    private LocalDate preorderEndDate;
    private BigDecimal preorderDiscountPercent;
    private LocalDate shippingDeadline;
    private int stockQuantity;
    private List<ProductImageDTO> images;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
