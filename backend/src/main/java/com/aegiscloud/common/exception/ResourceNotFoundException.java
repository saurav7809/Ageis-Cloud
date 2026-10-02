package com.aegiscloud.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when a requested resource is not found.
 * Maps to HTTP 404.
 */
@ResponseStatus(HttpStatus.NOT_FOUND)
public class ResourceNotFoundException extends RuntimeException {

    private final String resourceType;
    private final String resourceId;

    public ResourceNotFoundException(String resourceType, String resourceId) {
        super(String.format("%s not found with id: %s", resourceType, resourceId));
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    public ResourceNotFoundException(String message) {
        super(message);
        this.resourceType = null;
        this.resourceId = null;
    }

    public String getResourceType() { return resourceType; }
    public String getResourceId() { return resourceId; }
}
