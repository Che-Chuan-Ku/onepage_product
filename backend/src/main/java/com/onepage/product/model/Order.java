package com.onepage.product.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", unique = true, nullable = false, length = 50)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "website_id", nullable = false)
    private Website website;

    @Column(name = "customer_name", nullable = false, length = 100)
    private String customerName;

    @Column(name = "customer_phone", nullable = false, length = 20)
    private String customerPhone;

    @Column(name = "customer_email", nullable = false, length = 255)
    private String customerEmail;

    @Column(name = "shipping_address", columnDefinition = "text")
    private String shippingAddress;

    @Column(name = "shipping_method", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ShippingMethod shippingMethod;

    @Column(name = "shipping_fee", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "tax_id", length = 8)
    private String taxId;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING_PAYMENT;

    @Column(name = "is_preorder", nullable = false)
    @Builder.Default
    private boolean preorder = false;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderItem> orderItems = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public enum ShippingMethod {
        DELIVERY, PICKUP
    }

    public enum OrderStatus {
        PENDING_PAYMENT, PROCESSING_PAYMENT, PAID, SHIPPED, RETURNED, PAYMENT_FAILED
    }
}
