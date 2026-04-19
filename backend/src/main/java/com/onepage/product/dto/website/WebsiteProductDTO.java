package com.onepage.product.dto.website;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebsiteProductDTO {

    private Long websiteId;
    private Long productId;
    private String productName;
    private String productSlug;
    private LocalDateTime publishAt;
}
