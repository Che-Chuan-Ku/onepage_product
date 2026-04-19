package com.onepage.product.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User ownerUser;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(unique = true, nullable = false, length = 255)
    private String slug;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "price_unit", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private PriceUnit priceUnit;

    @Column(length = 255)
    private String packaging;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private ProductCategory category;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProductStatus status = ProductStatus.ACTIVE;

    @Column(name = "is_bundle", nullable = false)
    @Builder.Default
    private boolean bundle = false;

    @Column(name = "bundle_discount_percent", precision = 5, scale = 2)
    private BigDecimal bundleDiscountPercent;

    @Column(name = "is_preorder", nullable = false)
    @Builder.Default
    private boolean preorder = false;

    @Column(name = "preorder_start_date")
    private LocalDate preorderStartDate;

    @Column(name = "preorder_end_date")
    private LocalDate preorderEndDate;

    @Column(name = "preorder_discount_percent", precision = 5, scale = 2)
    private BigDecimal preorderDiscountPercent;

    @Column(name = "shipping_deadline")
    private LocalDate shippingDeadline;

    @Column(name = "stock_quantity", nullable = false)
    @Builder.Default
    private int stockQuantity = 0;

    @Column(name = "low_stock_threshold", nullable = false)
    @Builder.Default
    private int lowStockThreshold = 10;

    @Column(name = "low_stock_alerted", nullable = false)
    @Builder.Default
    private boolean lowStockAlerted = false;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private int version = 0;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    @Builder.Default
    private List<ProductImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "bundleProduct", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<BundleItem> bundleItems = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public enum PriceUnit {
        KG, CATTY
    }

    public enum ProductStatus {
        ACTIVE, INACTIVE
    }
}
