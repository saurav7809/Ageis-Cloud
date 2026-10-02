package com.aegiscloud;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * AegisCloud - Kubernetes Application Deployment and Reliability Platform
 *
 * Entry point for the Spring Boot control plane.
 */
@SpringBootApplication
@EnableJpaAuditing
@EnableAsync
@EnableScheduling
public class AegisCloudApplication {

    public static void main(String[] args) {
        SpringApplication.run(AegisCloudApplication.class, args);
    }
}
