package com.onepage.product.controller;

import com.onepage.product.dto.email.EmailTemplateDTO;
import com.onepage.product.dto.email.UpdateEmailTemplateRequest;
import com.onepage.product.service.EmailTemplateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/email-templates")
@RequiredArgsConstructor
public class EmailTemplateController {

    private final EmailTemplateService emailTemplateService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<EmailTemplateDTO>> listTemplates() {
        return ResponseEntity.ok(emailTemplateService.listTemplates());
    }

    @PutMapping("/{templateId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EmailTemplateDTO> updateTemplate(
            @PathVariable Long templateId,
            @Valid @RequestBody UpdateEmailTemplateRequest request) {
        return ResponseEntity.ok(emailTemplateService.updateTemplate(templateId, request));
    }

    @GetMapping(value = "/{templateId}/preview", produces = MediaType.TEXT_HTML_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> previewTemplate(@PathVariable Long templateId) {
        return ResponseEntity.ok(emailTemplateService.previewTemplate(templateId));
    }
}
