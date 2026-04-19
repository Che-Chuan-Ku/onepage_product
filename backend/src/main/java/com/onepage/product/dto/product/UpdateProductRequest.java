package com.onepage.product.dto.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class UpdateProductRequest {

    @NotBlank(message = "商品名稱為必填")
    private String name;

    private String description;

    @NotNull
    @DecimalMin(value = "0.01", message = "商品價格必須大於 0")
    private BigDecimal price;

    @NotBlank
    private String priceUnit;

    private String packaging;

    @NotNull
    private Long categoryId;

    private List<MultipartFile> images;

    private Boolean isBundle;

    private BigDecimal bundleDiscountPercent;

    private List<Long> bundleProductIds;

    private Boolean isPreorder;

    private LocalDate preorderStartDate;

    private LocalDate preorderEndDate;

    private BigDecimal preorderDiscountPercent;

    private LocalDate shippingDeadline;
}
