package com.onepage.product.dto.invoice;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagedInvoices {

    private List<InvoiceDTO> content;
    private long totalElements;
    private int totalPages;
    private int page;
    private int size;
}
