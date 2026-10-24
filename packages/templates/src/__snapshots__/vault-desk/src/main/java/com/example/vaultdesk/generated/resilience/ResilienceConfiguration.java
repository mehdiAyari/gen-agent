// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.resilience;

import com.example.vaultdesk.generated.AgentProperties;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.observation.ObservationRegistry;
import java.time.Duration;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.retry.TransientAiException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.retry.RetryPolicy;
import org.springframework.core.retry.RetryTemplate;
import org.springframework.web.client.ResourceAccessException;

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
        ChatModel fallbackModel = OllamaChatModel.builder()
            .ollamaApi(OllamaApi.builder().baseUrl(fallback.baseUrl()).build())
            .options(OllamaChatOptions.builder().model(fallback.model()).build())
            .retryTemplate(retries())
            .observationRegistry(observationRegistry)
            .build();
        return new ResilientModelAdvisor(breakers, fallbackModel, fallback.model());
    }

    /** Two retries, one then two seconds apart: the fallback is the last resort, it must answer fast or not at all. */
    private static RetryTemplate retries() {
        return new RetryTemplate(
            RetryPolicy.builder()
                .maxRetries(2)
                .includes(TransientAiException.class)
                .includes(ResourceAccessException.class)
                .delay(Duration.ofSeconds(1))
                .multiplier(2)
                .build()
        );
    }
}
