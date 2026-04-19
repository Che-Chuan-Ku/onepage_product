package com.onepage.product.dto.invoice;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceDTO {

    private Long id;
    private Long orderId;
    private String invoiceNumber;
    private String randomCode;
    private LocalDate invoiceDate;
    private BigDecimal amount;
    private String invoiceType;
    private String carrierType;
    private String carrierNumber;
    private String buyerTaxId;
    private String status;
    private String voidReason;
    private LocalDateTime voidedAt;
    private BigDecimal allowanceAmount;
    private String allowanceNumber;
    private LocalDateTime allowancedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
