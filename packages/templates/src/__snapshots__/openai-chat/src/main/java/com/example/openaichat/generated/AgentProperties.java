// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.openaichat.generated;

import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;

/**
 * Agent settings bound from the {@code agent} section of {@code application.yml}.
 *
 * @param systemPrompt the system prompt, kept in a resource file so it can be versioned and reviewed like code
 * @param memory how much of the conversation is sent back to the model
 * @param timeZone where the users are: the model is told the date of the day there
 */
@ConfigurationProperties("agent")
public record AgentProperties(Resource systemPrompt, Memory memory, ZoneId timeZone) {
    /**
     * @param window number of recent messages kept per conversation
     */
    public record Memory(int window) {}
}
