// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.chat;

import com.example.vaultdesk.generated.cache.ReplyCache;
import com.example.vaultdesk.generated.cache.SemanticCache;
import com.example.vaultdesk.generated.guard.Guardrails;
import com.example.vaultdesk.generated.limits.UsageLimits;
import com.example.vaultdesk.generated.privacy.Conversations;
import com.example.vaultdesk.generated.privacy.PersonalData;
import com.example.vaultdesk.generated.tool.ToolGuard;
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

    private final SemanticCache semanticCache;

    private final PersonalData personalData;

    private final Conversations conversations;

    private final Guardrails guardrails;

    ChatService(
        ChatClient chatClient,
        ChatMemory chatMemory,
        UsageLimits usageLimits,
        ReplyCache replyCache,
        ToolGuard toolGuard,
        SemanticCache semanticCache,
        PersonalData personalData,
        Conversations conversations,
        Guardrails guardrails
    ) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
        this.usageLimits = usageLimits;
        this.replyCache = replyCache;
        this.toolGuard = toolGuard;
        this.semanticCache = semanticCache;
        this.personalData = personalData;
        this.conversations = conversations;
        this.guardrails = guardrails;
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
        Optional<String> refusal = guardrails.refusalFor(request.message());
        if (refusal.isPresent()) {
            return new ChatMessageResponse(conversationId, refusal.get());
        }
        // The model, the memory and the caches only ever see tokens in place of personal data.
        String message = personalData.mask(memoryKey, request.message());
        conversations.touch(memoryKey, userId);
        boolean firstMessage = request.conversationId() == null;
        if (firstMessage) {
            Optional<String> cached = replyCache.find(userId, message).or(() -> semanticCache.find(userId, message));
            if (cached.isPresent()) {
                // Kept in the conversation as if the model had answered, so that it can go on from there.
                chatMemory.add(memoryKey, List.of(new UserMessage(message), new AssistantMessage(cached.get())));
                return new ChatMessageResponse(conversationId, cached.get());
            }
        }
        toolGuard.start(memoryKey);
        ChatResponse response = chatClient
            .prompt()
            .user(message)
            .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, memoryKey))
            .call()
            .chatResponse();
        usageLimits.recordTokens(userId, response.getMetadata().getUsage().getTotalTokens());
        String answer = response.getResult().getOutput().getText();
        // Checked before anything else sees it: the caches, the user.
        answer = guardrails.check(answer);
        // Never reused: an answer built from a tool depends on live data, and one about personal data is about someone.
        if (
            firstMessage &&
            !toolGuard.toolCalled() &&
            !PersonalData.containsTokens(message) &&
            !PersonalData.containsTokens(answer)
        ) {
            replyCache.put(userId, message, answer);
            semanticCache.put(userId, message, answer);
        }
        return new ChatMessageResponse(conversationId, personalData.restore(memoryKey, answer));
    }
}
