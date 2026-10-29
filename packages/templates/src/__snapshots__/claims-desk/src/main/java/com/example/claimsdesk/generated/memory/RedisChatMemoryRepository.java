// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated.memory;

import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Conversations in Redis, one list of messages per conversation: they survive restarts and every instance of the agent
 * shares them. Plain lists, so that any Redis runs it, without modules. Like Spring AI's JDBC repository, it keeps the
 * text of user, assistant and system messages, not the tool calls in between.
 */
@Component
class RedisChatMemoryRepository implements ChatMemoryRepository {

    private static final String PREFIX = "memory:";

    /** A message as stored: its type and its text. */
    record StoredMessage(String type, String text) {}

    private final StringRedisTemplate redis;

    private final JsonMapper json;

    RedisChatMemoryRepository(StringRedisTemplate redis, JsonMapper json) {
        this.redis = redis;
        this.json = json;
    }

    @Override
    public List<String> findConversationIds() {
        List<String> ids = new ArrayList<>();
        try (
            Cursor<String> keys = redis.scan(
                ScanOptions.scanOptions()
                    .match(PREFIX + "*")
                    .build()
            )
        ) {
            keys.forEachRemaining(key -> ids.add(key.substring(PREFIX.length())));
        }
        return ids;
    }

    @Override
    public List<Message> findByConversationId(String conversationId) {
        List<String> stored = redis.opsForList().range(PREFIX + conversationId, 0, -1);
        return stored == null ? List.of() : stored.stream().map(this::toMessage).toList();
    }

    @Override
    public void saveAll(String conversationId, List<Message> messages) {
        List<String> stored = messages
            .stream()
            .filter(
                message ->
                    switch (message.getMessageType()) {
                        case USER, SYSTEM -> true;
                        case ASSISTANT -> !((AssistantMessage) message).hasToolCalls();
                        case TOOL -> false;
                    }
            )
            .map(message ->
                json.writeValueAsString(new StoredMessage(message.getMessageType().name(), message.getText()))
            )
            .toList();
        String key = PREFIX + conversationId;
        // The whole conversation at once: a reader never sees it half written.
        redis.execute(
            new SessionCallback<Object>() {
                @Override
                public <K, V> Object execute(RedisOperations<K, V> operations) {
                    @SuppressWarnings("unchecked")
                    RedisOperations<String, String> strings = (RedisOperations<String, String>) operations;
                    strings.multi();
                    strings.delete(key);
                    if (!stored.isEmpty()) {
                        strings.opsForList().rightPushAll(key, stored);
                    }
                    return strings.exec();
                }
            }
        );
    }

    @Override
    public void deleteByConversationId(String conversationId) {
        redis.delete(PREFIX + conversationId);
    }

    private Message toMessage(String stored) {
        StoredMessage message = json.readValue(stored, StoredMessage.class);
        return switch (MessageType.valueOf(message.type())) {
            case USER -> new UserMessage(message.text());
            case SYSTEM -> new SystemMessage(message.text());
            case ASSISTANT -> new AssistantMessage(message.text());
            case TOOL -> throw new IllegalStateException("Tool messages are never stored");
        };
    }
}
