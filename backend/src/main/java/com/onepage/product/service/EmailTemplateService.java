package com.onepage.product.service;

import com.onepage.product.dto.email.EmailTemplateDTO;
import com.onepage.product.dto.email.TemplateVariableDTO;
import com.onepage.product.dto.email.UpdateEmailTemplateRequest;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.EmailTemplate;
import com.onepage.product.model.User;
import com.onepage.product.repository.EmailTemplateRepository;
import com.onepage.product.repository.UserRepository;
import com.onepage.product.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailTemplateService {

    private final EmailTemplateRepository emailTemplateRepository;
    private final UserRepository userRepository;

    // REQ-032: 可用變數清單（含中文說明）
    private static final List<TemplateVariableDTO> AVAILABLE_VARIABLES = Arrays.asList(
            TemplateVariableDTO.builder().variable("{{customerName}}").description("顧客姓名").build(),
            TemplateVariableDTO.builder().variable("{{orderNumber}}").description("訂單編號").build(),
            TemplateVariableDTO.builder().variable("{{totalAmount}}").description("訂單總金額").build(),
            TemplateVariableDTO.builder().variable("{{websiteName}}").description("網站名稱").build(),
            TemplateVariableDTO.builder().variable("{{contactInfo}}").description("店家聯絡資訊").build()
    );

    // REQ-034: RBAC - 每位使用者各自擁有一套獨立模板
    @Transactional(readOnly = true)
    public List<EmailTemplateDTO> listTemplates() {
        String email = SecurityUtils.getCurrentUserEmail();
        User currentUser = findUserByEmailOrThrow(email);

        List<EmailTemplate> templates = emailTemplateRepository.findByOwnerUserId(currentUser.getId());

        // If no templates exist for this user, create defaults from the global set
        if (templates.isEmpty()) {
            templates = initializeUserTemplates(currentUser);
        }

        return templates.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public EmailTemplateDTO updateTemplate(Long templateId, UpdateEmailTemplateRequest request) {
        EmailTemplate template = emailTemplateRepository.findById(templateId)
                .orElseThrow(() -> new BusinessException("模板不存在", HttpStatus.NOT_FOUND));

        // REQ-034: check ownership
        String email = SecurityUtils.getCurrentUserEmail();
        User currentUser = findUserByEmailOrThrow(email);
        if (!SecurityUtils.isAdmin() && !template.getOwnerUser().getId().equals(currentUser.getId())) {
            throw new BusinessException("無權限", HttpStatus.FORBIDDEN);
        }

        template.setSubject(request.getSubject());
        template.setBodyHtml(request.getBodyHtml());
        return toDTO(emailTemplateRepository.save(template));
    }

    @Transactional(readOnly = true)
    public String previewTemplate(Long templateId) {
        EmailTemplate template = emailTemplateRepository.findById(templateId)
                .orElseThrow(() -> new BusinessException("模板不存在", HttpStatus.NOT_FOUND));

        // REQ-032: apply sample data substitution including new variables
        return template.getBodyHtml()
                .replace("{{orderNumber}}", "ORD-20260501-001")
                .replace("{{customerName}}", "王小明")
                .replace("{{totalAmount}}", "1580")
                .replace("{{websiteName}}", "範例水果店")
                .replace("{{contactInfo}}", "電話：0912-345-678");
    }

    // Initialize default templates for a new user
    @Transactional
    private List<EmailTemplate> initializeUserTemplates(User user) {
        List<EmailTemplate> defaults = Arrays.asList(
                buildDefaultTemplate(user, EmailTemplate.TemplateType.ORDER_CONFIRMED,
                        "【OnePage】訂單確認通知 - {{orderNumber}}",
                        "<h2>感謝您的訂購！</h2><p>親愛的 {{customerName}}，</p><p>您的訂單 <strong>{{orderNumber}}</strong> 已成功建立。</p><p>訂單金額：NT$ {{totalAmount}}</p><p>來自 {{websiteName}}，如有問題請聯絡：{{contactInfo}}</p>"),
                buildDefaultTemplate(user, EmailTemplate.TemplateType.PAYMENT_SUCCESS,
                        "【OnePage】付款成功通知 - {{orderNumber}}",
                        "<h2>付款成功！</h2><p>親愛的 {{customerName}}，</p><p>您的訂單 <strong>{{orderNumber}}</strong> 已付款成功。</p><p>訂單金額：NT$ {{totalAmount}}</p><p>{{websiteName}}</p>"),
                buildDefaultTemplate(user, EmailTemplate.TemplateType.PAYMENT_FAILED,
                        "【OnePage】付款失敗通知 - {{orderNumber}}",
                        "<h2>付款失敗</h2><p>親愛的 {{customerName}}，</p><p>您的訂單 <strong>{{orderNumber}}</strong> 付款未成功，請重新付款。</p><p>{{websiteName}}，聯絡方式：{{contactInfo}}</p>"),
                buildDefaultTemplate(user, EmailTemplate.TemplateType.SHIPPED,
                        "【OnePage】出貨通知 - {{orderNumber}}",
                        "<h2>您的訂單已出貨！</h2><p>親愛的 {{customerName}}，</p><p>您的訂單 <strong>{{orderNumber}}</strong> 已出貨，請耐心等候收貨。</p><p>{{websiteName}}</p>")
        );
        return emailTemplateRepository.saveAll(defaults);
    }

    private EmailTemplate buildDefaultTemplate(User user, EmailTemplate.TemplateType type, String subject, String bodyHtml) {
        return EmailTemplate.builder()
                .ownerUser(user)
                .templateType(type)
                .subject(subject)
                .bodyHtml(bodyHtml)
                .build();
    }

    private EmailTemplateDTO toDTO(EmailTemplate template) {
        return EmailTemplateDTO.builder()
                .id(template.getId())
                .templateType(template.getTemplateType().name())
                .subject(template.getSubject())
                .bodyHtml(template.getBodyHtml())
                .availableVariables(AVAILABLE_VARIABLES)
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }

    private User findUserByEmailOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("使用者不存在", HttpStatus.UNAUTHORIZED));
    }
}
