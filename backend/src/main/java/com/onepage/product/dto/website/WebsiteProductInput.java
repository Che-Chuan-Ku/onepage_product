package com.onepage.product.dto.website;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WebsiteProductInput {

    @NotNull
    private Long productId;

    @NotNull
    private LocalDateTime publishAt;
}
