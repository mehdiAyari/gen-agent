// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.privacy;

import com.example.bankdesk.generated.AgentProperties;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps personal data away from the model: each value becomes a token such as [EMAIL_1] before the model sees it, and
 * comes back in place of its token in the reply and in tool arguments. The tokens of a conversation are kept in Redis
 * for {@code agent.privacy.ttl}, so that the model can refer to them later in the conversation.
 */
@Component
public class PersonalData {

    /** Added to the system prompt: the model keeps the tokens as they are. */
    public static final String PROMPT_NOTE = """

    Text in square brackets such as [EMAIL_1] or [PHONE_2] stands for personal data hidden from you. Repeat these \
    tokens exactly as they are whenever you need the data.""";

    /** A token, with or without its brackets: small models often drop them in tool arguments. */
    private static final Pattern TOKEN = Pattern.compile("\\[?\\b((?:EMAIL|IBAN|CARD|SSN|PHONE)_\\d+)\\b]?");

    private final StringRedisTemplate redis;

    private final Duration ttl;

    PersonalData(StringRedisTemplate redis, AgentProperties properties) {
        this.redis = redis;
        this.ttl = properties.privacy().ttl();
    }

    /** The text with its personal data replaced by the tokens of the conversation, new ones added as needed. */
    public String mask(String conversationKey, String text) {
        List<PersonalDataPatterns.Found> found = PersonalDataPatterns.find(text);
        if (found.isEmpty()) {
            return text;
        }
        String key = key(conversationKey);
        Map<String, String> tokens = new HashMap<>(redis.<String, String>opsForHash().entries(key));
        StringBuilder masked = new StringBuilder(text);
        for (int i = found.size() - 1; i >= 0; i--) {
            PersonalDataPatterns.Found data = found.get(i);
            String token = tokens
                .entrySet()
                .stream()
                .filter(entry -> entry.getValue().equals(data.value()))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElseGet(() -> {
                    long sameKind = tokens
                        .keySet()
                        .stream()
                        .filter(name -> name.startsWith("[" + data.kind() + "_"))
                        .count();
                    String created = "[" + data.kind() + "_" + (sameKind + 1) + "]";
                    tokens.put(created, data.value());
                    return created;
                });
            masked.replace(data.start(), data.end(), token);
        }
        redis.opsForHash().putAll(key, tokens);
        redis.expire(key, ttl);
        return masked.toString();
    }

    /** The text with the tokens of the conversation replaced by the data they stand for. */
    public String restore(String conversationKey, String text) {
        if (!containsTokens(text)) {
            return text;
        }
        Map<String, String> tokens = redis.<String, String>opsForHash().entries(key(conversationKey));
        return TOKEN.matcher(text).replaceAll(match ->
            Matcher.quoteReplacement(tokens.getOrDefault("[" + match.group(1) + "]", match.group()))
        );
    }

    public void forget(String conversationKey) {
        redis.delete(key(conversationKey));
    }

    /** Whether the text holds tokens: such an answer is about someone, and never cached. */
    public static boolean containsTokens(String text) {
        return TOKEN.matcher(text).find();
    }

    private static String key(String conversationKey) {
        return "pii:" + conversationKey;
    }
}
