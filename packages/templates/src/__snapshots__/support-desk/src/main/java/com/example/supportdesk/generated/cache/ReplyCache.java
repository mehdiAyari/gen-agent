// Managed by gen-agent: changes here are overwritten. Set the duration in application.yml.
package com.example.supportdesk.generated.cache;

import com.example.supportdesk.generated.AgentProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Reuses the first answer of a conversation when the same user asks the same question again, without calling the
 * model. The key holds the user, the model and the system prompt: an answer never reaches another user, and a new
 * prompt or model starts afresh.
 */
@Component
public class ReplyCache {

    private final StringRedisTemplate redis;

    private final Duration ttl;

    private final String context;

    ReplyCache(
        StringRedisTemplate redis,
        AgentProperties properties,
        @Value("${spring.ai.mistralai.chat.model}") String model
    ) {
        this.redis = redis;
        this.ttl = properties.cache().ttl();
        try {
            this.context = model + "\n" + properties.systemPrompt().getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new UncheckedIOException("Cannot read the system prompt", exception);
        }
    }

    public Optional<String> find(String userId, String question) {
        return Optional.ofNullable(redis.opsForValue().get(key(userId, question)));
    }

    public void put(String userId, String question, String answer) {
        redis.opsForValue().set(key(userId, question), answer, ttl);
    }

    /** Questions that differ only by case or spacing share their answer. */
    private String key(String userId, String question) {
        String normalized = question.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return "reply:" + HexFormat.of().formatHex(sha256(userId + "\n" + context + "\n" + normalized));
    }

    private static byte[] sha256(String text) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is part of every Java runtime", exception);
        }
    }
}
