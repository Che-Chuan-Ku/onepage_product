package com.onepage.product.dto.payment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentDTO {

    private Long id;
    private Long orderId;
    private String paymentMethod;
    private String ecpayPaymentUrl;
    private LocalDateTime expireAt;
    private String status;
    private LocalDateTime paidAt;
    private LocalDateTime createdAt;
}
