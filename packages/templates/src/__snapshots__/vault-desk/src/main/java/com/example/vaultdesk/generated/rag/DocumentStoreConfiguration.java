// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.rag;

import com.example.vaultdesk.generated.AgentProperties;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration(proxyBeanMethods = false)
class DocumentStoreConfiguration {

    /** Its own table, agent_document: the passages of the documents, compared by cosine distance. */
    @Bean
    PgVectorStore documentStore(JdbcTemplate jdbcTemplate, EmbeddingModel embeddingModel, AgentProperties properties) {
        return PgVectorStore.builder(jdbcTemplate, embeddingModel)
            .vectorTableName("agent_document")
            .dimensions(properties.rag().dimensions())
            .distanceType(PgVectorStore.PgDistanceType.COSINE_DISTANCE)
            .indexType(PgVectorStore.PgIndexType.HNSW)
            .initializeSchema(true)
            .build();
    }
}
