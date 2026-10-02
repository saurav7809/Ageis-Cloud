package com.aegiscloud.user.controller;

import com.aegiscloud.common.dto.ApiResponse;
import com.aegiscloud.user.dto.AuthResponse;
import com.aegiscloud.user.dto.LoginRequest;
import com.aegiscloud.user.dto.RegisterRequest;
import com.aegiscloud.user.entity.User;
import com.aegiscloud.user.service.AuthService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for authentication operations.
 * All endpoints under /api/auth are public (no JWT required).
 */
@RestController
@RequestMapping("/api/auth")
@Slf4j
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * POST /api/auth/register
     * Register a new user account.
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Account created successfully"));
    }

    /**
     * POST /api/auth/login
     * Authenticate and receive JWT token.
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Login successful"));
    }

    /**
     * GET /api/auth/me
     * Get the current authenticated user's profile.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<AuthResponse.UserProfile>> getCurrentUser(
            @AuthenticationPrincipal User user) {
        AuthResponse.UserProfile profile = AuthResponse.UserProfile.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().name())
                .createdAt(user.getCreatedAt())
                .build();
        return ResponseEntity.ok(ApiResponse.success(profile));
    }
}
