package com.onepage.product.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "email_notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @Column(name = "template_type", nullable = false, length = 50)
    private String templateType;

    @Column(name = "recipient_email", nullable = false, length = 255)
    private String recipientEmail;

    @Column(nullable = false, length = 255)
    private String subject;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private NotificationStatus status = NotificationStatus.SENT;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum NotificationStatus {
        SENT, FAILED
    }
}
