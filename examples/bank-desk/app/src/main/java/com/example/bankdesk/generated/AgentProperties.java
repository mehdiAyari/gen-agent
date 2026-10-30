// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.bankdesk.generated;

import java.time.Duration;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;

/**
 * Agent settings bound from the {@code agent} section of {@code application.yml}.
 *
 * @param systemPrompt the system prompt, kept in a resource file so it can be versioned and reviewed like code
 * @param memory how much of the conversation is sent back to the model
 * @param timeZone where the users are: the model is told the date of the day there
 * @param fallbackAnswer the answer sent when no model can answer
 * @param fallback the model that answers when the first one fails
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
    ZoneId timeZone,
    String fallbackAnswer,
    Fallback fallback,
    Duration timeout,
    Guard guard,
    Limits limits,
    Cache cache,
    Privacy privacy
) {
    /**
     * @param window number of recent messages kept per conversation
     * @param retention how long an unused conversation is kept before it is purged
     */
    public record Memory(int window, Duration retention) {}

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
     * @param semantic answers reused for questions of the same meaning
     */
    public record Cache(Duration ttl, Semantic semantic) {
        /**
         * @param threshold similarity from 0 to 1 above which two questions share their answer
         * @param dimensions size of the embeddings of the model
         */
        public record Semantic(double threshold, int dimensions) {}
    }

    /**
     * @param model name of the fallback model
     */
    public record Fallback(String model) {}

    /**
     * @param refusal the answer sent instead of one the guardrails refuse
     */
    public record Guard(String refusal) {}

    /**
     * @param ttl how long the personal data behind the tokens of a conversation is kept
     */
    public record Privacy(Duration ttl) {}
}
