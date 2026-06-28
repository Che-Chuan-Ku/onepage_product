package com.gomoku.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Q3: password minLength 8, must contain lowercase letter + digit. */
public record RegisterRequest(
        @NotBlank String username,
        @NotBlank @Email String email,
        @NotBlank
        @Pattern(regexp = "^(?=.*[a-z])(?=.*\\d).{8,}$",
                message = "密碼最短 8 碼且須同時含英文小寫字母與數字")
        String password
) {
}
