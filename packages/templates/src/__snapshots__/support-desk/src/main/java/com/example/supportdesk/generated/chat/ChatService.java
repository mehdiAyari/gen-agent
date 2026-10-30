// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.chat;

import com.example.supportdesk.generated.cache.ReplyCache;
import com.example.supportdesk.generated.limits.UsageLimits;
import com.example.supportdesk.generated.tool.ToolGuard;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
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

    private final ReplyCache replyCache;

    private final ToolGuard toolGuard;

    ChatService(
        ChatClient chatClient,
        ChatMemory chatMemory,
        UsageLimits usageLimits,
        ReplyCache replyCache,
        ToolGuard toolGuard
    ) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
        this.usageLimits = usageLimits;
        this.replyCache = replyCache;
        this.toolGuard = toolGuard;
    }

    ChatMessageResponse reply(ChatMessageRequest request, String userId) {
        usageLimits.checkRequest(userId);
        String conversationId =
            request.conversationId() != null ? request.conversationId() : UUID.randomUUID().toString();
        String memoryKey = memoryKeyOf(userId, conversationId);
        if (request.conversationId() != null && chatMemory.get(memoryKey).isEmpty()) {
            throw new UnknownConversationException(conversationId);
        }
        String message = request.message();
        boolean firstMessage = request.conversationId() == null;
        if (firstMessage) {
            Optional<String> cached = replyCache.find(userId, message);
            if (cached.isPresent()) {
                // Kept in the conversation as if the model had answered, so that it can go on from there.
                chatMemory.add(memoryKey, List.of(new UserMessage(message), new AssistantMessage(cached.get())));
                return new ChatMessageResponse(conversationId, cached.get());
            }
        }
        toolGuard.start();
        ChatResponse response = chatClient
            .prompt()
            .user(message)
            .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, memoryKey))
            .call()
            .chatResponse();
        usageLimits.recordTokens(userId, response.getMetadata().getUsage().getTotalTokens());
        String answer = response.getResult().getOutput().getText();
        // Never reused: an empty answer, one built from a tool, which depends on live data.
        if (firstMessage && !answer.isBlank() && !toolGuard.toolCalled()) {
            replyCache.put(userId, message, answer);
        }
        return new ChatMessageResponse(conversationId, answer);
    }

    // Stored under a key of its user: another user's conversation id leads nowhere. A name-based UUID keeps the key
    // within the 36 characters of Spring AI's memory table.
    private static String memoryKeyOf(String userId, String conversationId) {
        return UUID.nameUUIDFromBytes((userId + ":" + conversationId).getBytes(StandardCharsets.UTF_8)).toString();
    }
}
