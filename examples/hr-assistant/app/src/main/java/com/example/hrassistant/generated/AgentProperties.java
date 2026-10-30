// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.hrassistant.generated;

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
 * @param limits what each user may use
 * @param cache how first answers are reused
 */
@ConfigurationProperties("agent")
public record AgentProperties(Resource systemPrompt, Memory memory, ZoneId timeZone, Limits limits, Cache cache) {
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
}
