package com.aegiscloud.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when a business rule is violated.
 * Maps to HTTP 400.
 */
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class BusinessException extends RuntimeException {

    public BusinessException(String message) {
        super(message);
    }
}
