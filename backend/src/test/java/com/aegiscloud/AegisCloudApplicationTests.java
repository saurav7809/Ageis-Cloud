package com.aegiscloud;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Smoke test — verifies the Spring Boot application context loads successfully.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.flyway.enabled=false",
    "aegiscloud.security.jwt.secret=dGhpcy1pcy1hLXRlc3Qtc2VjcmV0LWtleS1mb3ItanVuaXQtdGVzdHMtb25seQ==",
    "aegiscloud.kubernetes.in-cluster=false",
})
class AegisCloudApplicationTests {

    @Test
    void contextLoads() {
        // Verifies Spring application context loads successfully
    }
}
