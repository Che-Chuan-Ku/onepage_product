package com.onepage.product.controller;

import com.onepage.product.dto.invoice.InvoiceDTO;
import com.onepage.product.dto.invoice.PagedInvoices;
import com.onepage.product.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;

    @GetMapping
    public ResponseEntity<PagedInvoices> listInvoices(
            @RequestParam(required = false) Long websiteId,
            @RequestParam(required = false) String invoiceNumber,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(invoiceService.listInvoices(
                websiteId, invoiceNumber, startDate, endDate, status, page, size));
    }

    @PostMapping("/{invoiceId}/void")
    public ResponseEntity<InvoiceDTO> voidInvoice(
            @PathVariable Long invoiceId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(invoiceService.voidInvoice(invoiceId, body.get("reason")));
    }

    @PostMapping("/{invoiceId}/allowance")
    public ResponseEntity<InvoiceDTO> allowanceInvoice(
            @PathVariable Long invoiceId,
            @RequestBody Map<String, Object> body) {
        BigDecimal amount = new BigDecimal(body.get("amount").toString());
        return ResponseEntity.ok(invoiceService.allowanceInvoice(invoiceId, amount));
    }

    @PostMapping("/{invoiceId}/sync")
    public ResponseEntity<InvoiceDTO> syncInvoice(@PathVariable Long invoiceId) {
        return ResponseEntity.ok(invoiceService.syncInvoice(invoiceId));
    }
}
