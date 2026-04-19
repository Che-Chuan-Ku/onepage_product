package com.onepage.product.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "email_templates",
        uniqueConstraints = @UniqueConstraint(columnNames = {"owner_user_id", "template_type"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User ownerUser;

    @Column(name = "template_type", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private TemplateType templateType;

    @Column(nullable = false, length = 255)
    private String subject;

    @Column(name = "body_html", nullable = false, columnDefinition = "text")
    private String bodyHtml;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public enum TemplateType {
        ORDER_CONFIRMED, PAYMENT_SUCCESS, PAYMENT_FAILED, SHIPPED
    }
}
