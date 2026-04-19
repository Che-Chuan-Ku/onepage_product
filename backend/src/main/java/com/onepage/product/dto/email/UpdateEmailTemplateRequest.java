package com.onepage.product.dto.email;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateEmailTemplateRequest {

    @NotBlank
    private String subject;

    @NotBlank
    private String bodyHtml;
}
