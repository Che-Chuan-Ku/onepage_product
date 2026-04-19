package com.onepage.product.service;

import com.onepage.product.dto.payment.CreatePaymentRequest;
import com.onepage.product.dto.payment.PaymentDTO;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.*;
import com.onepage.product.repository.InvoiceRepository;
import com.onepage.product.repository.OrderRepository;
import com.onepage.product.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    @Value("${ecpay.merchant-id}")
    private String merchantId;

    @Value("${ecpay.payment-api-url}")
    private String paymentApiUrl;

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final EmailNotificationService emailNotificationService;

    @Transactional
    public PaymentDTO createPayment(Long orderId, CreatePaymentRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException("訂單不存在", HttpStatus.NOT_FOUND));

        if (order.getStatus() != Order.OrderStatus.PENDING_PAYMENT) {
            throw new BusinessException("僅待付款訂單可建立付款", HttpStatus.BAD_REQUEST);
        }

        Payment.PaymentMethod method = Payment.PaymentMethod.valueOf(request.getPaymentMethod());
        String fakeEcpayUrl = paymentApiUrl + "?MerchantID=" + merchantId
                + "&OrderNumber=" + order.getOrderNumber()
                + "&TotalAmount=" + order.getTotalAmount().intValue();

        Payment payment = Payment.builder()
                .order(order)
                .paymentMethod(method)
                .ecpayPaymentUrl(fakeEcpayUrl)
                .expireAt(LocalDateTime.now().plusMinutes(30))
                .status(Payment.PaymentStatus.PENDING)
                .build();

        payment = paymentRepository.save(payment);

        // Update order status to PROCESSING_PAYMENT
        order.setStatus(Order.OrderStatus.PROCESSING_PAYMENT);
        orderRepository.save(order);

        // Create invoice record if invoice info provided
        if (request.getInvoiceType() != null) {
            createInvoiceRecord(order, request);
        }

        return toDTO(payment);
    }

    @Transactional
    public String handleEcpayCallback(Map<String, String> params) {
        String ecpayTradeNo = params.get("TradeNo");
        String rtnCode = params.get("RtnCode");
        String merchantTradeNo = params.get("MerchantTradeNo");

        log.info("ECPay callback received: TradeNo={}, RtnCode={}", ecpayTradeNo, rtnCode);

        // Find payment by order number (MerchantTradeNo = orderNumber)
        orderRepository.findByOrderNumber(merchantTradeNo).ifPresent(order -> {
            paymentRepository.findByOrderId(order.getId()).ifPresent(payment -> {
                String rawCallback = params.toString();
                payment.setRawCallback(rawCallback);
                payment.setEcpayTradeNo(ecpayTradeNo);

                if ("1".equals(rtnCode)) {
                    // Payment success
                    payment.setStatus(Payment.PaymentStatus.SUCCESS);
                    payment.setPaidAt(LocalDateTime.now());
                    paymentRepository.save(payment);

                    order.setStatus(Order.OrderStatus.PAID);
                    orderRepository.save(order);

                    emailNotificationService.sendPaymentSuccess(order);
                } else {
                    // Payment failed
                    payment.setStatus(Payment.PaymentStatus.FAILED);
                    paymentRepository.save(payment);

                    order.setStatus(Order.OrderStatus.PAYMENT_FAILED);
                    orderRepository.save(order);

                    emailNotificationService.sendPaymentFailed(order);
                }
            });
        });

        return "1|OK";
    }

    private void createInvoiceRecord(Order order, CreatePaymentRequest request) {
        Invoice.InvoiceType invoiceType = Invoice.InvoiceType.valueOf(request.getInvoiceType());
        Invoice.CarrierType carrierType = null;
        if (request.getCarrierType() != null) {
            carrierType = Invoice.CarrierType.valueOf(request.getCarrierType());
        }

        Invoice invoice = Invoice.builder()
                .order(order)
                .amount(order.getTotalAmount())
                .invoiceType(invoiceType)
                .carrierType(carrierType)
                .carrierNumber(request.getCarrierNumber())
                .buyerTaxId(request.getBuyerTaxId())
                .status(Invoice.InvoiceStatus.SYNCING)
                .build();

        invoiceRepository.save(invoice);
    }

    private PaymentDTO toDTO(Payment payment) {
        return PaymentDTO.builder()
                .id(payment.getId())
                .orderId(payment.getOrder().getId())
                .paymentMethod(payment.getPaymentMethod().name())
                .ecpayPaymentUrl(payment.getEcpayPaymentUrl())
                .expireAt(payment.getExpireAt())
                .status(payment.getStatus().name())
                .paidAt(payment.getPaidAt())
                .createdAt(payment.getCreatedAt())
                .build();
    }
}
