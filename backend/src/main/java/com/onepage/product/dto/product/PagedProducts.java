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
public class PagedProducts {

    private List<ProductDTO> content;
    private long totalElements;
    private int totalPages;
    private int page;
    private int size;
}
