package com.gomoku.web;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Standard response envelope per api.yml: {status, code, message, data}.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public class ManageResponse<T> {

    private String status;
    private String code;
    private String message;
    private T data;

    public ManageResponse() {
    }

    public ManageResponse(String status, String code, String message, T data) {
        this.status = status;
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ManageResponse<T> success(T data) {
        return new ManageResponse<>("success", "200000", "OK", data);
    }

    public static <T> ManageResponse<T> created(T data) {
        return new ManageResponse<>("success", "201000", "Created", data);
    }

    public static <T> ManageResponse<T> of(String status, String code, String message, T data) {
        return new ManageResponse<>(status, code, message, data);
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public T getData() { return data; }
    public void setData(T data) { this.data = data; }
}
