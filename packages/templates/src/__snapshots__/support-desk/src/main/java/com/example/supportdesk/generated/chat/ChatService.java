// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.chat;

import com.example.supportdesk.generated.limits.UsageLimits;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Service;

/**
 * Sends a user message to the model within its conversation, so earlier messages are remembered. Conversations are
 * kept under their user: nobody can read or continue someone else's.
 */
@Service
class ChatService {

    private final ChatClient chatClient;

    private final ChatMemory chatMemory;

    private final UsageLimits usageLimits;

    ChatService(ChatClient chatClient, ChatMemory chatMemory, UsageLimits usageLimits) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
        this.usageLimits = usageLimits;
    }

    ChatMessageResponse reply(ChatMessageRequest request, String userId) {
        usageLimits.checkRequest(userId);
        String conversationId =
            request.conversationId() != null ? request.conversationId() : UUID.randomUUID().toString();
        // Stored under a key of its user: another user's conversation id leads nowhere. A name-based UUID keeps the
        // key within the 36 characters of Spring AI's memory table.
        String memoryKey = UUID.nameUUIDFromBytes(
            (userId + ":" + conversationId).getBytes(StandardCharsets.UTF_8)
        ).toString();
        if (request.conversationId() != null && chatMemory.get(memoryKey).isEmpty()) {
            throw new UnknownConversationException(conversationId);
        }
        ChatResponse response = chatClient
            .prompt()
            .user(request.message())
            .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, memoryKey))
            .call()
            .chatResponse();
        usageLimits.recordTokens(userId, response.getMetadata().getUsage().getTotalTokens());
        return new ChatMessageResponse(conversationId, response.getResult().getOutput().getText());
    }
}
