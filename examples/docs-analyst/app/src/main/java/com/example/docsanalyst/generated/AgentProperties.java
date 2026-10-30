// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.docsanalyst.generated;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;

/**
 * Agent settings bound from the {@code agent} section of {@code application.yml}.
 *
 * @param systemPrompt the system prompt, kept in a resource file so it can be versioned and reviewed like code
 * @param memory how much of the conversation is sent back to the model
 * @param rag the knowledge base the answers draw on
 */
@ConfigurationProperties("agent")
public record AgentProperties(Resource systemPrompt, Memory memory, Rag rag) {
    /**
     * @param window number of recent messages kept per conversation
     */
    public record Memory(int window) {}

    /**
     * @param documents the folder indexed at startup
     * @param topK passages sent with each question
     * @param chunkSize size of a passage, in tokens
     * @param dimensions size of the embeddings of the model
     */
    public record Rag(Path documents, int topK, int chunkSize, int dimensions) {}
}
