package com.onepage.product.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "bundle_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BundleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bundle_product_id", nullable = false)
    private Product bundleProduct;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "included_product_id", nullable = false)
    private Product includedProduct;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
