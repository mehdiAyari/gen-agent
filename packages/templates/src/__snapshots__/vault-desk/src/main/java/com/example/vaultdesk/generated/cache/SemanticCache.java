// Managed by gen-agent: changes here are overwritten. Set the threshold in application.yml.
package com.example.vaultdesk.generated.cache;

import com.example.vaultdesk.generated.AgentProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(SemanticCache.class);

    private final VectorStore store;

    private final double threshold;

    SemanticCache(PgVectorStore semanticCacheStore, AgentProperties properties) {
        this.store = semanticCacheStore;
        this.threshold = properties.cache().semantic().threshold();
    }

    /** The answer to a question of the same meaning; none when the embedding model or the store cannot tell. */
    public Optional<String> find(String userId, String question) {
        try {
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
        } catch (RuntimeException failure) {
            // A cache is a shortcut: when it fails, the model answers.
            log.warn("The semantic cache could not be read: {}", failure.toString());
            return Optional.empty();
        }
    }

    public void put(String userId, String question, String answer) {
        try {
            store.add(List.of(new Document(question, Map.of("user", user(userId), "answer", answer))));
        } catch (RuntimeException failure) {
            log.warn("The semantic cache could not keep an answer: {}", failure.toString());
        }
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
