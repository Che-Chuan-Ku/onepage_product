package com.onepage.product.dto.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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

    @Pattern(regexp = "^\\d{8}$", message = "統一編號必須為8碼數字")
    private String taxId;

    @NotEmpty
    @Valid
    private List<OrderItemRequest> items;

    @Data
    public static class OrderItemRequest {

        @NotNull
        private Long productId;

        @NotNull
        @Min(1)
        private Integer quantity;
    }
}
