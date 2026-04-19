package com.onepage.product.dto.website;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebsiteDTO {

    private Long id;
    private Long ownerUserId;
    private String name;
    private String title;
    private String subtitle;
    private String browserTitle;
    private String footerTitle;
    private String footerSubtitle;
    private String subscriptionPlan;
    private LocalDateTime publishStartAt;
    private LocalDateTime publishEndAt;
    private String bannerImageUrl;
    private String promoImageUrl;
    private BigDecimal freeShippingThreshold;
    private String status;
    private String storefrontUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
