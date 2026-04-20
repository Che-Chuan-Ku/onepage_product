package com.onepage.product.dto.shipping;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ShippingCalculateRequest {

    @NotNull
    private Long websiteId;

    @NotBlank
    private String shippingMethod;

    private String address;

    private BigDecimal orderAmount;
}
