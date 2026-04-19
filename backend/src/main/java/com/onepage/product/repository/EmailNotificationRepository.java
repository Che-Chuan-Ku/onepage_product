package com.onepage.product.repository;

import com.onepage.product.model.EmailNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmailNotificationRepository extends JpaRepository<EmailNotification, Long> {

    List<EmailNotification> findByOrderId(Long orderId);
}
