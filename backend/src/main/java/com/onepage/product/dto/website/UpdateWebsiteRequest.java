package com.onepage.product.dto.website;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class UpdateWebsiteRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String title;

    private String subtitle;

    private String browserTitle;

    private String footerTitle;

    private String footerSubtitle;

    private String subscriptionPlan;

    private LocalDateTime publishStartAt;

    private LocalDateTime publishEndAt;

    private MultipartFile bannerImage;

    private MultipartFile promoImage;

    private BigDecimal freeShippingThreshold;
}
