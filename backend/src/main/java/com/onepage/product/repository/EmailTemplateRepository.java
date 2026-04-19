package com.onepage.product.repository;

import com.onepage.product.model.EmailTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long> {

    Optional<EmailTemplate> findByTemplateType(EmailTemplate.TemplateType templateType);

    // REQ-034 RBAC: owner-scoped queries
    List<EmailTemplate> findByOwnerUserId(Long ownerUserId);

    Optional<EmailTemplate> findByOwnerUserIdAndTemplateType(Long ownerUserId, EmailTemplate.TemplateType templateType);
}
