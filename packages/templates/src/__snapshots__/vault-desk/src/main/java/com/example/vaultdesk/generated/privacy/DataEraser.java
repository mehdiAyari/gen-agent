// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.privacy;

import com.example.vaultdesk.generated.cache.ReplyCache;
import com.example.vaultdesk.generated.cache.SemanticCache;
import com.example.vaultdesk.generated.limits.UsageLimits;
import java.util.List;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.stereotype.Service;

/**
 * Erases what the agent keeps about a user: conversations, the personal data behind their tokens, cached answers and usage counters
 * (GDPR right to erasure).
 */
@Service
public class DataEraser {

    private final Conversations conversations;

    private final ChatMemory chatMemory;

    private final PersonalData personalData;

    private final ReplyCache replyCache;

    private final SemanticCache semanticCache;

    private final UsageLimits usageLimits;

    DataEraser(
        Conversations conversations,
        ChatMemory chatMemory,
        PersonalData personalData,
        ReplyCache replyCache,
        SemanticCache semanticCache,
        UsageLimits usageLimits
    ) {
        this.conversations = conversations;
        this.chatMemory = chatMemory;
        this.personalData = personalData;
        this.replyCache = replyCache;
        this.semanticCache = semanticCache;
        this.usageLimits = usageLimits;
    }

    /** Returns the number of conversations erased. */
    public int erase(String userId) {
        List<String> keys = conversations.of(userId);
        keys.forEach(this::eraseConversation);
        replyCache.forget(userId);
        semanticCache.forget(userId);
        usageLimits.forget(userId);
        return keys.size();
    }

    public void eraseConversation(String memoryKey) {
        chatMemory.clear(memoryKey);
        personalData.forget(memoryKey);
        conversations.delete(memoryKey);
    }
}
