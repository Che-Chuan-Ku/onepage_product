package com.onepage.product.service;

import com.onepage.product.model.EmailNotification;
import com.onepage.product.model.EmailTemplate;
import com.onepage.product.model.Order;
import com.onepage.product.model.Product;
import com.onepage.product.repository.EmailNotificationRepository;
import com.onepage.product.repository.EmailTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailNotificationService {

    private final JavaMailSender mailSender;
    private final EmailTemplateRepository emailTemplateRepository;
    private final EmailNotificationRepository emailNotificationRepository;

    @Async
    public void sendOrderConfirmed(Order order) {
        sendOrderEmail(order, EmailTemplate.TemplateType.ORDER_CONFIRMED);
    }

    @Async
    public void sendPaymentSuccess(Order order) {
        sendOrderEmail(order, EmailTemplate.TemplateType.PAYMENT_SUCCESS);
    }

    @Async
    public void sendPaymentFailed(Order order) {
        sendOrderEmail(order, EmailTemplate.TemplateType.PAYMENT_FAILED);
    }

    @Async
    public void sendShipped(Order order) {
        sendOrderEmail(order, EmailTemplate.TemplateType.SHIPPED);
    }

    @Async
    public void sendLowStockAlert(Product product, List<String> adminEmails) {
        String subject = "【低庫存警示】商品 " + product.getName() + " 庫存不足";
        String body = "<p>商品 <strong>" + product.getName() + "</strong> 庫存已低於門檻。</p>"
                + "<p>目前庫存：" + product.getStockQuantity() + "</p>"
                + "<p>低庫存門檻：" + product.getLowStockThreshold() + "</p>"
                + "<p>請及時補充庫存。</p>";

        for (String email : adminEmails) {
            try {
                var message = mailSender.createMimeMessage();
                var helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setTo(email);
                helper.setSubject(subject);
                helper.setText(body, true);
                mailSender.send(message);

                EmailNotification notification = EmailNotification.builder()
                        .templateType("LOW_STOCK_ALERT")
                        .recipientEmail(email)
                        .subject(subject)
                        .sentAt(LocalDateTime.now())
                        .status(EmailNotification.NotificationStatus.SENT)
                        .build();
                emailNotificationRepository.save(notification);
            } catch (Exception e) {
                log.error("Failed to send low stock alert to {}", email, e);
            }
        }
    }

    private void sendOrderEmail(Order order, EmailTemplate.TemplateType templateType) {
        // REQ-034: Use the website owner's template (fall back to any template of this type)
        // REQ-032: Apply {{websiteName}} and {{contactInfo}} substitution
        Long ownerUserId = (order.getWebsite() != null && order.getWebsite().getOwnerUser() != null)
                ? order.getWebsite().getOwnerUser().getId() : null;

        java.util.Optional<EmailTemplate> templateOpt = ownerUserId != null
                ? emailTemplateRepository.findByOwnerUserIdAndTemplateType(ownerUserId, templateType)
                : emailTemplateRepository.findByTemplateType(templateType);

        templateOpt.ifPresentOrElse(
                template -> {
                    try {
                        String body = applyTemplate(template.getBodyHtml(), order);
                        var message = mailSender.createMimeMessage();
                        var helper = new MimeMessageHelper(message, true, "UTF-8");
                        helper.setTo(order.getCustomerEmail());
                        helper.setSubject(template.getSubject());
                        helper.setText(body, true);
                        mailSender.send(message);

                        EmailNotification notification = EmailNotification.builder()
                                .order(order)
                                .templateType(templateType.name())
                                .recipientEmail(order.getCustomerEmail())
                                .subject(template.getSubject())
                                .sentAt(LocalDateTime.now())
                                .status(EmailNotification.NotificationStatus.SENT)
                                .build();
                        emailNotificationRepository.save(notification);
                    } catch (Exception e) {
                        log.error("Failed to send email for order {}", order.getOrderNumber(), e);
                        saveFailedNotification(order, templateType);
                    }
                },
                () -> log.warn("Email template not found for owner {} type {}", ownerUserId, templateType)
        );
    }

    private String applyTemplate(String template, Order order) {
        // REQ-032: include {{websiteName}} and {{contactInfo}} variables
        String websiteName = (order.getWebsite() != null) ? order.getWebsite().getName() : "";
        String contactInfo = (order.getWebsite() != null) ? order.getWebsite().getFooterSubtitle() : "";
        if (contactInfo == null) contactInfo = "";

        return template
                .replace("{{orderNumber}}", order.getOrderNumber())
                .replace("{{customerName}}", order.getCustomerName())
                .replace("{{totalAmount}}", order.getTotalAmount().toString())
                .replace("{{websiteName}}", websiteName)
                .replace("{{contactInfo}}", contactInfo);
    }

    private void saveFailedNotification(Order order, EmailTemplate.TemplateType templateType) {
        EmailNotification notification = EmailNotification.builder()
                .order(order)
                .templateType(templateType.name())
                .recipientEmail(order.getCustomerEmail())
                .subject("Email 發送失敗")
                .sentAt(LocalDateTime.now())
                .status(EmailNotification.NotificationStatus.FAILED)
                .build();
        emailNotificationRepository.save(notification);
    }
}
