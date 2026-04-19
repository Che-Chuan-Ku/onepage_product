package com.onepage.product.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private Order order;

    @Column(name = "invoice_number", length = 20)
    private String invoiceNumber;

    @Column(name = "random_code", length = 4)
    private String randomCode;

    @Column(name = "invoice_date")
    private LocalDate invoiceDate;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "invoice_type", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private InvoiceType invoiceType;

    @Column(name = "carrier_type", length = 20)
    @Enumerated(EnumType.STRING)
    private CarrierType carrierType;

    @Column(name = "carrier_number", length = 20)
    private String carrierNumber;

    @Column(name = "buyer_tax_id", length = 8)
    private String buyerTaxId;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private InvoiceStatus status = InvoiceStatus.SYNCING;

    @Column(name = "void_reason", columnDefinition = "text")
    private String voidReason;

    @Column(name = "voided_at")
    private LocalDateTime voidedAt;

    @Column(name = "allowance_amount", precision = 10, scale = 2)
    private BigDecimal allowanceAmount;

    @Column(name = "allowance_number", length = 50)
    private String allowanceNumber;

    @Column(name = "allowanced_at")
    private LocalDateTime allowancedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public enum InvoiceType {
        TWO_COPIES, THREE_COPIES
    }

    public enum CarrierType {
        MOBILE_BARCODE, CITIZEN_CERTIFICATE
    }

    public enum InvoiceStatus {
        SYNCING, ISSUED, VOIDED, ALLOWANCED
    }
}
