// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.cache;

import com.example.vaultdesk.generated.AgentProperties;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration(proxyBeanMethods = false)
class SemanticCacheConfiguration {

    /** Its own table, agent_semantic_cache: the embeddings of the provider, compared by cosine distance. */
    @Bean
    PgVectorStore semanticCacheStore(
        JdbcTemplate jdbcTemplate,
        EmbeddingModel embeddingModel,
        AgentProperties properties
    ) {
        return PgVectorStore.builder(jdbcTemplate, embeddingModel)
            .vectorTableName("agent_semantic_cache")
            .dimensions(properties.cache().semantic().dimensions())
            .distanceType(PgVectorStore.PgDistanceType.COSINE_DISTANCE)
            .indexType(PgVectorStore.PgIndexType.HNSW)
            .initializeSchema(true)
            .build();
    }
}
