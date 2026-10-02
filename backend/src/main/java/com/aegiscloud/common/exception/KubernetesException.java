package com.aegiscloud.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when Kubernetes operations fail or cluster is unreachable.
 * Maps to HTTP 503.
 */
@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
public class KubernetesException extends RuntimeException {

    public KubernetesException(String message) {
        super(message);
    }

    public KubernetesException(String message, Throwable cause) {
        super(message, cause);
    }
}
