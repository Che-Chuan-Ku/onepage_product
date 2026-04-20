package com.onepage.product.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateUserRoleRequest {

    @NotBlank
    private String role;
}
