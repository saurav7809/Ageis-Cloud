package com.aegiscloud.user.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

/**
 * Auth response DTO containing JWT token and user info.
 */
@Data
@Builder
public class AuthResponse {

    private String token;
    private String tokenType;
    private long expiresIn;
    private UserProfile user;

    @Data
    @Builder
    public static class UserProfile {
        private UUID id;
        private String email;
        private String firstName;
        private String lastName;
        private String role;
        private Instant createdAt;
    }
}
