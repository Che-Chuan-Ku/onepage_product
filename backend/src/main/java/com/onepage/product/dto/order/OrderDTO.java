package com.onepage.product.dto.order;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderDTO {

    private Long id;
    private String orderNumber;
    private Long websiteId;
    private String websiteName;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String shippingAddress;
    private String shippingMethod;
    private BigDecimal shippingFee;
    private BigDecimal subtotal;
    private BigDecimal totalAmount;
    private String note;
    private String taxId;
    private String status;
    private boolean isPreorder;
    @JsonProperty("items")
    private List<OrderItemDTO> orderItems;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemDTO {
        private Long id;
        private Long productId;
        private String productName;
        private BigDecimal productPrice;
        private int quantity;
        private BigDecimal discountAmount;
        private BigDecimal subtotal;
    }
}
