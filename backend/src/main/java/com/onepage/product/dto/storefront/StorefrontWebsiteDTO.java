package com.onepage.product.dto.storefront;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorefrontWebsiteDTO {

    private Long id;
    private String name;
    private String title;
    private String subtitle;
    private String browserTitle;
    private String footerTitle;
    private String footerSubtitle;
    private String bannerImageUrl;
    private String promoImageUrl;
    private BigDecimal freeShippingThreshold;
    private List<StorefrontProductCardDTO> products;
}
