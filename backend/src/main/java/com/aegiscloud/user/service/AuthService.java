package com.aegiscloud.user.service;

import com.aegiscloud.common.exception.BusinessException;
import com.aegiscloud.config.AegisCloudProperties;
import com.aegiscloud.security.JwtService;
import com.aegiscloud.user.dto.AuthResponse;
import com.aegiscloud.user.dto.LoginRequest;
import com.aegiscloud.user.dto.RegisterRequest;
import com.aegiscloud.user.entity.User;
import com.aegiscloud.user.entity.UserRole;
import com.aegiscloud.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Authentication service — handles registration, login, and token generation.
 */
@Service
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final AegisCloudProperties properties;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            AegisCloudProperties properties) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.properties = properties;
    }

    /**
     * Register a new user with DEVELOPER role by default.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("Email is already registered: " + request.getEmail());
        }

        User user = User.builder()
                .email(request.getEmail().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .role(UserRole.DEVELOPER)
                .isActive(true)
                .build();

        user = userRepository.save(user);
        log.info("New user registered: {} ({})", user.getEmail(), user.getId());

        String jwtToken = jwtService.generateToken(user);
        return buildAuthResponse(user, jwtToken);
    }

    /**
     * Authenticate a user and return JWT token.
     */
    public AuthResponse login(LoginRequest request) {
        // Spring Security handles password verification and throws BadCredentialsException if invalid
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail().toLowerCase().trim(),
                        request.getPassword()
                )
        );

        User user = userRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new BusinessException("User not found"));

        String jwtToken = jwtService.generateToken(user);
        log.info("User logged in: {}", user.getEmail());

        return buildAuthResponse(user, jwtToken);
    }

    private AuthResponse buildAuthResponse(User user, String token) {
        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(properties.getSecurity().getJwt().getExpirationMs() / 1000)
                .user(AuthResponse.UserProfile.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .firstName(user.getFirstName())
                        .lastName(user.getLastName())
                        .role(user.getRole().name())
                        .createdAt(user.getCreatedAt())
                        .build())
                .build();
    }
}
