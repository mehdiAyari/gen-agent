// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated;

import com.redis.testcontainers.RedisContainer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;

/**
 * The services of the agent, started in Docker for the tests and wired to Spring by {@code @ServiceConnection}: the
 * tests run against the same Redis as production, not against mocks.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    RedisContainer redis() {
        return new RedisContainer("redis:8.10.2-alpine");
    }
}
