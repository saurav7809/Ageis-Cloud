package com.aegiscloud.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * AegisCloud application configuration properties.
 * Mapped from the 'aegiscloud' prefix in application.yml.
 */
@Component
@ConfigurationProperties(prefix = "aegiscloud")
@Getter
@Setter
public class AegisCloudProperties {

    private Security security = new Security();
    private Kubernetes kubernetes = new Kubernetes();
    private AiService aiService = new AiService();
    private Cors cors = new Cors();

    @Getter
    @Setter
    public static class Security {
        private Jwt jwt = new Jwt();

        @Getter
        @Setter
        public static class Jwt {
            private String secret;
            private long expirationMs = 86400000L; // 24h default
        }
    }

    @Getter
    @Setter
    public static class Kubernetes {
        private String context = "docker-desktop";
        private boolean inCluster = false;
        private String defaultNamespace = "aegiscloud";
        private int connectionTimeoutSeconds = 30;
    }

    @Getter
    @Setter
    public static class AiService {
        private String baseUrl = "http://localhost:8090";
        private int timeoutSeconds = 30;
    }

    @Getter
    @Setter
    public static class Cors {
        private List<String> allowedOrigins = List.of("http://localhost:5173", "http://localhost:3000");
    }
}
