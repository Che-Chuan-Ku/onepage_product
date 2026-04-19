package com.onepage.product.dto.payment;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePaymentRequest {

    @NotBlank
    private String paymentMethod;

    private String invoiceType;

    private String carrierType;

    private String carrierNumber;

    private String buyerTaxId;
}
