// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.resilience;

import com.example.bankdesk.generated.AgentProperties;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** The circuit breakers come from {@code resilience4j} in application.yml. */
@Configuration(proxyBeanMethods = false)
class ResilienceConfiguration {

    @Bean
    ResilientModelAdvisor resilientModelAdvisor(
        CircuitBreakerRegistry breakers,
        ChatModel chatModel,
        AgentProperties properties
    ) {
        // Another model of the same provider.
        return new ResilientModelAdvisor(breakers, chatModel, properties.fallback().model());
    }
}
