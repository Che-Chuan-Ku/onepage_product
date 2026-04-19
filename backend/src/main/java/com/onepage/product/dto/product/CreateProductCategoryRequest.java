package com.onepage.product.dto.product;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateProductCategoryRequest {

    @NotBlank
    @Size(min = 1, max = 100)
    private String name;

    private Long parentId;
}
