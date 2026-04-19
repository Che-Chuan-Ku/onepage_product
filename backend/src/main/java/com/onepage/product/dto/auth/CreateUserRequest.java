package com.onepage.product.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateUserRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String name;

    @NotBlank
    @Size(min = 8, message = "密碼須為 8 碼以上")
    private String password;

    @NotNull
    private String role;

    private boolean sendWelcomeEmail = false;
}
