package com.gomoku.exception;

import org.springframework.http.HttpStatus;

/**
 * Business error codes aligned with api.yml responses (6-digit code = HTTP + serial).
 */
public enum ErrorCode {
    BAD_REQUEST("400001", HttpStatus.BAD_REQUEST, "請求參數錯誤"),
    UNAUTHORIZED("401001", HttpStatus.UNAUTHORIZED, "未登入或憑證無效"),
    FORBIDDEN("403001", HttpStatus.FORBIDDEN, "權限不足"),
    NOT_FOUND("404001", HttpStatus.NOT_FOUND, "資源不存在"),
    VALIDATION_FAILED("422000", HttpStatus.UNPROCESSABLE_ENTITY, "驗證失敗"),
    UNPROCESSABLE("422001", HttpStatus.UNPROCESSABLE_ENTITY, "業務規則不滿足"),
    INVALID_MOVE("422002", HttpStatus.UNPROCESSABLE_ENTITY, "落子不合法"),
    USERNAME_TAKEN("422003", HttpStatus.UNPROCESSABLE_ENTITY, "帳號已存在"),
    EMAIL_TAKEN("422004", HttpStatus.UNPROCESSABLE_ENTITY, "Email 已存在"),
    NOT_YOUR_TURN("422005", HttpStatus.UNPROCESSABLE_ENTITY, "非當前回合"),
    INTERNAL_ERROR("500001", HttpStatus.INTERNAL_SERVER_ERROR, "伺服器內部錯誤");

    private final String code;
    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(String code, HttpStatus httpStatus, String defaultMessage) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public String getCode() { return code; }
    public HttpStatus getHttpStatus() { return httpStatus; }
    public String getDefaultMessage() { return defaultMessage; }
}
