// Managed by gen-agent: changes here are overwritten.
package com.example.docshelper.generated;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * The services of the agent, started in Docker for the tests and wired to Spring by {@code @ServiceConnection}: the
 * tests run against the same Postgres as production, not against mocks.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        // Postgres with the pgvector extension, as in production.
        return new PostgreSQLContainer(
            DockerImageName.parse("pgvector/pgvector:0.8.7-pg18").asCompatibleSubstituteFor("postgres")
        );
    }
}
