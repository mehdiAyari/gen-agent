// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated.resilience;

import com.example.claimsdesk.generated.AgentProperties;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.observation.ObservationRegistry;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The circuit breakers come from {@code resilience4j} in application.yml. The fallback model is built here rather than
 * by Spring AI, so that the agent keeps a single {@code ChatModel} bean.
 */
@Configuration(proxyBeanMethods = false)
class ResilienceConfiguration {

    @Bean
    ResilientModelAdvisor resilientModelAdvisor(
        CircuitBreakerRegistry breakers,
        AgentProperties properties,
        ObjectProvider<ObservationRegistry> observations
    ) {
        AgentProperties.Fallback fallback = properties.fallback();
        ObservationRegistry observationRegistry = observations.getIfUnique(() -> ObservationRegistry.NOOP);
        ChatModel fallbackModel = OpenAiChatModel.builder()
            .options(
                OpenAiChatOptions.builder().apiKey(fallback.apiKey()).model(fallback.model()).maxRetries(2).build()
            )
            .observationRegistry(observationRegistry)
            .build();
        return new ResilientModelAdvisor(breakers, fallbackModel, fallback.model());
    }
}
