package com.onepage.product.dto.shipping;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShippingCalculateResponse {

    private BigDecimal shippingFee;
    private boolean freeShipping;
    private String reason;
}
