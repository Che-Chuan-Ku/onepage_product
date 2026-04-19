package com.onepage.product.dto.product;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductCategoryDTO {

    private Long id;
    private Long ownerUserId;
    private String name;
    private Long parentId;
    private List<ProductCategoryDTO> children;
}
