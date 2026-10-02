package com.aegiscloud.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * CORS configuration — allows the React frontend to communicate with the backend.
 */
@Configuration
public class CorsConfig {

    private final AegisCloudProperties properties;

    public CorsConfig(AegisCloudProperties properties) {
        this.properties = properties;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Set allowed origins from config (never wildcard in production)
        configuration.setAllowedOrigins(properties.getCors().getAllowedOrigins());

        // HTTP methods
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

        // Headers
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Request-ID"));

        // Allow credentials (needed for Authorization header)
        configuration.setAllowCredentials(true);

        // Cache preflight for 1 hour
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);

        return source;
    }
}
