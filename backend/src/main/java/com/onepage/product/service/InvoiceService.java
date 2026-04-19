package com.onepage.product.service;

import com.onepage.product.dto.invoice.InvoiceDTO;
import com.onepage.product.dto.invoice.PagedInvoices;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.Invoice;
import com.onepage.product.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;

    @Transactional(readOnly = true)
    public PagedInvoices listInvoices(Long websiteId, String invoiceNumber,
                                       String startDate, String endDate,
                                       String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Specification<Invoice> spec = buildInvoiceSpec(websiteId, invoiceNumber, startDate, endDate, status);
        Page<Invoice> result = invoiceRepository.findAll(spec, pageable);

        return PagedInvoices.builder()
                .content(result.getContent().stream().map(this::toDTO).collect(Collectors.toList()))
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(page)
                .size(size)
                .build();
    }

    @Transactional
    public InvoiceDTO voidInvoice(Long invoiceId, String reason) {
        Invoice invoice = findInvoiceOrThrow(invoiceId);
        if (invoice.getStatus() != Invoice.InvoiceStatus.ISSUED) {
            throw new BusinessException("僅已開立且同月份的發票可作廢", HttpStatus.BAD_REQUEST);
        }
        // Check same month
        if (invoice.getInvoiceDate() != null
                && !invoice.getInvoiceDate().getMonth().equals(LocalDate.now().getMonth())) {
            throw new BusinessException("僅已開立且同月份的發票可作廢", HttpStatus.BAD_REQUEST);
        }

        invoice.setStatus(Invoice.InvoiceStatus.VOIDED);
        invoice.setVoidReason(reason);
        invoice.setVoidedAt(LocalDateTime.now());
        return toDTO(invoiceRepository.save(invoice));
    }

    @Transactional
    public InvoiceDTO allowanceInvoice(Long invoiceId, BigDecimal amount) {
        Invoice invoice = findInvoiceOrThrow(invoiceId);
        if (invoice.getStatus() != Invoice.InvoiceStatus.ISSUED) {
            throw new BusinessException("僅已開立發票可折讓", HttpStatus.BAD_REQUEST);
        }
        if (amount.compareTo(invoice.getAmount()) > 0) {
            throw new BusinessException("折讓金額不可超過原始發票金額", HttpStatus.BAD_REQUEST);
        }

        invoice.setStatus(Invoice.InvoiceStatus.ALLOWANCED);
        invoice.setAllowanceAmount(amount);
        invoice.setAllowancedAt(LocalDateTime.now());
        return toDTO(invoiceRepository.save(invoice));
    }

    @Transactional
    public InvoiceDTO syncInvoice(Long invoiceId) {
        Invoice invoice = findInvoiceOrThrow(invoiceId);
        if (invoice.getStatus() != Invoice.InvoiceStatus.SYNCING) {
            throw new BusinessException("僅同步中狀態的發票可手動同步", HttpStatus.BAD_REQUEST);
        }
        // In real implementation, call ECPay invoice API here
        // For now, mock the sync
        log.info("Syncing invoice {} with ECPay", invoiceId);
        return toDTO(invoice);
    }

    private Invoice findInvoiceOrThrow(Long invoiceId) {
        return invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new BusinessException("發票不存在", HttpStatus.NOT_FOUND));
    }

    private Specification<Invoice> buildInvoiceSpec(Long websiteId, String invoiceNumber,
                                                      String startDate, String endDate, String status) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (websiteId != null) {
                predicates.add(cb.equal(root.get("order").get("website").get("id"), websiteId));
            }
            if (invoiceNumber != null) {
                predicates.add(cb.like(root.get("invoiceNumber"), "%" + invoiceNumber + "%"));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), Invoice.InvoiceStatus.valueOf(status)));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"),
                        LocalDate.parse(startDate).atStartOfDay()));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"),
                        LocalDate.parse(endDate).atTime(23, 59, 59)));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private InvoiceDTO toDTO(Invoice invoice) {
        return InvoiceDTO.builder()
                .id(invoice.getId())
                .orderId(invoice.getOrder().getId())
                .invoiceNumber(invoice.getInvoiceNumber())
                .randomCode(invoice.getRandomCode())
                .invoiceDate(invoice.getInvoiceDate())
                .amount(invoice.getAmount())
                .invoiceType(invoice.getInvoiceType().name())
                .carrierType(invoice.getCarrierType() != null ? invoice.getCarrierType().name() : null)
                .carrierNumber(invoice.getCarrierNumber())
                .buyerTaxId(invoice.getBuyerTaxId())
                .status(invoice.getStatus().name())
                .voidReason(invoice.getVoidReason())
                .voidedAt(invoice.getVoidedAt())
                .allowanceAmount(invoice.getAllowanceAmount())
                .allowanceNumber(invoice.getAllowanceNumber())
                .allowancedAt(invoice.getAllowancedAt())
                .createdAt(invoice.getCreatedAt())
                .updatedAt(invoice.getUpdatedAt())
                .build();
    }
}
