package com.gomoku.exception;

import com.gomoku.web.ManageResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ManageResponse<Object>> handleBusiness(BusinessException ex) {
        ErrorCode ec = ex.getErrorCode();
        ManageResponse<Object> body = ManageResponse.of(
                "error", ec.getCode(), ex.getMessage(), new HashMap<>());
        return ResponseEntity.status(ec.getHttpStatus()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ManageResponse<Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(
                fe -> fieldErrors.put(fe.getField(), fe.getDefaultMessage()));
        ManageResponse<Object> body = ManageResponse.of(
                "error", ErrorCode.BAD_REQUEST.getCode(), "請求參數錯誤", fieldErrors);
        return ResponseEntity.status(ErrorCode.BAD_REQUEST.getHttpStatus()).body(body);
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ManageResponse<Object>> handleNoResource(
            org.springframework.web.servlet.resource.NoResourceFoundException ex) {
        ManageResponse<Object> body = ManageResponse.of(
                "error", ErrorCode.NOT_FOUND.getCode(), "路徑不存在", new HashMap<>());
        return ResponseEntity.status(ErrorCode.NOT_FOUND.getHttpStatus()).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ManageResponse<Object>> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);  // never swallow the stack
        ManageResponse<Object> body = ManageResponse.of(
                "error", ErrorCode.INTERNAL_ERROR.getCode(),
                ErrorCode.INTERNAL_ERROR.getDefaultMessage(), new HashMap<>());
        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.getHttpStatus()).body(body);
    }
}
