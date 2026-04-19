package com.onepage.product.dto.product;

import jakarta.validation.constraints.*;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class CreateProductRequest {

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

    @Min(value = 0, message = "庫存數量必須 >= 0")
    private int stockQuantity;

    private List<MultipartFile> images;

    private boolean bundle = false;

    private BigDecimal bundleDiscountPercent;

    private List<Long> bundleProductIds;

    private boolean preorder = false;

    private LocalDate preorderStartDate;

    private LocalDate preorderEndDate;

    private BigDecimal preorderDiscountPercent;
}
