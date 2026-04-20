package com.onepage.product.dto.invoice;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VoidInvoiceRequest {

    @NotBlank
    private String reason;
}
