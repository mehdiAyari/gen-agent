// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.claimsdesk.generated;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;

/**
 * Agent settings bound from the {@code agent} section of {@code application.yml}.
 *
 * @param systemPrompt the system prompt, kept in a resource file so it can be versioned and reviewed like code
 * @param memory how much of the conversation is sent back to the model
 * @param fallbackAnswer the answer sent when no model can answer
 * @param fallback the model that answers when the first one fails
 * @param routing the models of simple and complex messages
 * @param timeout the longest a request may take
 * @param guard what the guardrails answer
 * @param limits what each user may use
 * @param cache how first answers are reused
 * @param privacy how long the personal data behind the tokens of a conversation is kept
 */
@ConfigurationProperties("agent")
public record AgentProperties(
    Resource systemPrompt,
    Memory memory,
    String fallbackAnswer,
    Fallback fallback,
    Routing routing,
    Duration timeout,
    Guard guard,
    Limits limits,
    Cache cache,
    Privacy privacy
) {
    /**
     * @param window number of recent messages kept per conversation
     */
    public record Memory(int window) {}

    /**
     * What each user may use, counted separately.
     *
     * @param requests messages a user may send per {@code requestsPeriod}
     * @param requestsPeriod period of the request limit
     * @param tokens model tokens a user may spend per {@code tokensPeriod}
     * @param tokensPeriod period of the token budget, given back in full at its end
     */
    public record Limits(long requests, Duration requestsPeriod, long tokens, Duration tokensPeriod) {}

    /**
     * @param ttl how long a first answer is reused for the same question of the same user
     */
    public record Cache(Duration ttl) {}

    /**
     * @param model name of the fallback model
     * @param apiKey API key of its provider
     */
    public record Fallback(String model, String apiKey) {}

    /**
     * @param simple model of simple messages
     * @param complex model of the others
     */
    public record Routing(String simple, String complex) {}

    /**
     * @param refusal the answer sent instead of one the guardrails refuse
     */
    public record Guard(String refusal) {}

    /**
     * @param ttl how long the personal data behind the tokens of a conversation is kept
     */
    public record Privacy(Duration ttl) {}
}
