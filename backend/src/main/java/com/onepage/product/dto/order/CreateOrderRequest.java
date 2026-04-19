package com.onepage.product.dto.order;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CreateOrderRequest {

    @NotNull
    private Long websiteId;

    @NotBlank
    private String customerName;

    @NotBlank
    private String customerPhone;

    @NotBlank
    @Email
    private String customerEmail;

    private String shippingAddress;

    @NotBlank
    private String shippingMethod;

    private String note;

    private String taxId;

    @NotEmpty
    private List<OrderItemRequest> items;

    @Data
    public static class OrderItemRequest {

        @NotNull
        private Long productId;

        @NotNull
        private int quantity;
    }
}
