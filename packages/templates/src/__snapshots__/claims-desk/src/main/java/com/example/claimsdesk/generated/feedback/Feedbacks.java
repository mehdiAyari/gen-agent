// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated.feedback;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import java.util.Locale;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * What users think of the answers: counted in {@code agent.feedback} by rating, added to the trace of the request,
 * and kept in the {@code agent_feedback} table to read the answers rated down.
 */
@Component
public class Feedbacks {

    private final JdbcClient jdbc;

    private final MeterRegistry meterRegistry;

    private final Tracer tracer;

    Feedbacks(JdbcClient jdbc, MeterRegistry meterRegistry, Tracer tracer) {
        this.jdbc = jdbc;
        this.meterRegistry = meterRegistry;
        // At zero from the start: Prometheus counts the first rating only when the counter was there before it.
        for (Rating rating : Rating.values()) {
            meterRegistry.counter("agent.feedback", "rating", rating.name().toLowerCase(Locale.ROOT));
        }
        this.tracer = tracer;
    }

    public void record(String userId, String conversationId, Rating rating, String comment) {
        jdbc.sql(
            """
            INSERT INTO agent_feedback (user_id, conversation_id, rating, comment, created_at)
            VALUES (:user, :conversation, :rating, :comment, now())
            """
        )
            .param("user", userId)
            .param("conversation", conversationId)
            .param("rating", rating.name())
            .param("comment", comment)
            .update();
        meterRegistry.counter("agent.feedback", "rating", rating.name().toLowerCase(Locale.ROOT)).increment();
        Span span = tracer.currentSpan();
        if (span != null) {
            span.tag("agent.conversation", conversationId).event("feedback " + rating.name().toLowerCase(Locale.ROOT));
        }
    }

    public enum Rating {
        UP,
        DOWN,
    }
}
