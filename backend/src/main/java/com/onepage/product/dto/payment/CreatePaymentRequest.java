package com.onepage.product.dto.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CreatePaymentRequest {

    @NotBlank
    private String paymentMethod;

    @NotBlank
    private String invoiceType;

    // enum: MOBILE_BARCODE, CITIZEN_CERTIFICATE (per api.yml spec, nullable)
    private String carrierType;

    private String carrierNumber;

    @Pattern(regexp = "^\\d{8}$", message = "統一編號必須為8碼數字")
    private String buyerTaxId;
}
