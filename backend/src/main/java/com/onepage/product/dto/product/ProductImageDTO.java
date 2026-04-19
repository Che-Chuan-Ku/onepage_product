package com.onepage.product.dto.product;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductImageDTO {

    private Long id;
    private String imageUrl;
    private int sortOrder;
}
