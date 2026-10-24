// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated.resilience;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.core.Ordered;

/**
 * Calls the model through a circuit breaker. When it fails, or its breaker is open after repeated failures, the
 * fallback model answers instead, through its own breaker; when both are down, {@link ModelUnavailableException}
 * tells the agent to send its fallback answer.
 *
 * <p>The innermost advisor: every call to the model, each round of tool calls included, goes through here.
 */
public class ResilientModelAdvisor implements CallAdvisor {

    private static final Logger log = LoggerFactory.getLogger(ResilientModelAdvisor.class);

    private final CircuitBreaker breaker;

    private final ChatModel fallbackModel;

    private final String fallbackName;

    private final CircuitBreaker fallbackBreaker;

    public ResilientModelAdvisor(CircuitBreakerRegistry breakers, ChatModel fallbackModel, String fallbackName) {
        this.breaker = breakers.circuitBreaker("chat-model");
        this.fallbackModel = fallbackModel;
        this.fallbackName = fallbackName;
        this.fallbackBreaker = breakers.circuitBreaker("fallback-chat-model");
    }

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest request, CallAdvisorChain chain) {
        try {
            return breaker.executeSupplier(() -> chain.nextCall(request));
        } catch (RuntimeException failure) {
            if (Thread.currentThread().isInterrupted()) {
                // The request ran out of time: nothing else is tried.
                throw failure;
            }
            log.warn("The model failed, {} answers instead: {}", fallbackName, failure.toString());
            try {
                ChatResponse response = fallbackBreaker.executeSupplier(() ->
                    fallbackModel.call(forFallback(request.prompt()))
                );
                return ChatClientResponse.builder().chatResponse(response).context(request.context()).build();
            } catch (RuntimeException fallbackFailure) {
                fallbackFailure.addSuppressed(failure);
                throw new ModelUnavailableException(fallbackFailure);
            }
        }
    }

    /** The prompt with the options of the fallback model and the tools of the first one: each provider reads only its own options. */
    private Prompt forFallback(Prompt prompt) {
        ChatOptions.Builder<?> options = fallbackModel.getOptions().mutate().model(fallbackName);
        if (
            options instanceof ToolCallingChatOptions.Builder<?> tools &&
            prompt.getOptions() instanceof ToolCallingChatOptions first
        ) {
            tools.toolCallbacks(first.getToolCallbacks()).toolContext(first.getToolContext());
        }
        return prompt.mutate().chatOptions(options.build()).build();
    }

    @Override
    public String getName() {
        return "resilient-model";
    }

    @Override
    public int getOrder() {
        // Right before the call to the model.
        return Ordered.LOWEST_PRECEDENCE - 1;
    }
}
