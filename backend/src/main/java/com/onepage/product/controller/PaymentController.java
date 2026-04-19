package com.onepage.product.controller;

import com.onepage.product.dto.payment.CreatePaymentRequest;
import com.onepage.product.dto.payment.PaymentDTO;
import com.onepage.product.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/storefront/orders/{orderId}/payment")
    public ResponseEntity<PaymentDTO> createPayment(
            @PathVariable Long orderId,
            @Valid @RequestBody CreatePaymentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(paymentService.createPayment(orderId, request));
    }

    @PostMapping(value = "/payment/ecpay/callback", produces = "text/plain")
    public ResponseEntity<String> ecpayCallback(@RequestParam Map<String, String> params) {
        return ResponseEntity.ok(paymentService.handleEcpayCallback(params));
    }
}
