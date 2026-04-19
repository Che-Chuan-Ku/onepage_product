package com.onepage.product.dto.email;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailTemplateDTO {

    private Long id;
    private String templateType;
    private String subject;
    private String bodyHtml;
    private List<TemplateVariableDTO> availableVariables;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
