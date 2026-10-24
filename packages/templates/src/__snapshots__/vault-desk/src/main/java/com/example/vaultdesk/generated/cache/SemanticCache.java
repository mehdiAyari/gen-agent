// Managed by gen-agent: changes here are overwritten. Set the threshold in application.yml.
package com.example.vaultdesk.generated.cache;

import com.example.vaultdesk.generated.AgentProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.stereotype.Component;

/**
 * Reuses the first answer of a conversation when the same user asks a question of the same meaning again: questions
 * are compared by their embeddings in pgvector, above {@code agent.cache.semantic.threshold}. Entries are filtered by
 * user, so that an answer never reaches anyone else.
 */
@Component
public class SemanticCache {

    private final VectorStore store;

    private final double threshold;

    SemanticCache(PgVectorStore semanticCacheStore, AgentProperties properties) {
        this.store = semanticCacheStore;
        this.threshold = properties.cache().semantic().threshold();
    }

    public Optional<String> find(String userId, String question) {
        return store
            .similaritySearch(
                SearchRequest.builder()
                    .query(question)
                    .topK(1)
                    .similarityThreshold(threshold)
                    .filterExpression(ofUser(userId))
                    .build()
            )
            .stream()
            .findFirst()
            .map(document -> (String) document.getMetadata().get("answer"));
    }

    public void put(String userId, String question, String answer) {
        store.add(List.of(new Document(question, Map.of("user", user(userId), "answer", answer))));
    }

    public void forget(String userId) {
        store.delete(ofUser(userId));
    }

    private static Filter.Expression ofUser(String userId) {
        return new FilterExpressionBuilder().eq("user", user(userId)).build();
    }

    /** A hash, not the user id itself: the table holds no identifier. */
    private static String user(String userId) {
        return UUID.nameUUIDFromBytes(userId.getBytes(StandardCharsets.UTF_8)).toString();
    }
}
