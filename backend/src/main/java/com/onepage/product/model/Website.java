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
@Table(name = "websites")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Website {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User ownerUser;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 255)
    private String subtitle;

    @Column(name = "browser_title", length = 255)
    private String browserTitle;

    @Column(name = "footer_title", length = 255)
    private String footerTitle;

    @Column(name = "footer_subtitle", columnDefinition = "text")
    private String footerSubtitle;

    @Column(name = "subscription_plan", columnDefinition = "text")
    private String subscriptionPlan;

    @Column(name = "publish_start_at")
    private LocalDateTime publishStartAt;

    @Column(name = "publish_end_at")
    private LocalDateTime publishEndAt;

    @Column(name = "banner_image_url", length = 500)
    private String bannerImageUrl;

    @Column(name = "promo_image_url", length = 500)
    private String promoImageUrl;

    @Column(name = "free_shipping_threshold", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal freeShippingThreshold = new BigDecimal("1500.00");

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private WebsiteStatus status = WebsiteStatus.DRAFT;

    @OneToMany(mappedBy = "website", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<WebsiteProduct> websiteProducts = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public enum WebsiteStatus {
        DRAFT, PUBLISHED, OFFLINE
    }
}
