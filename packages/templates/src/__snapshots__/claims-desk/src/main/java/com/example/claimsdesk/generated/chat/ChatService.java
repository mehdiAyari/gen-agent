// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated.chat;

import com.example.claimsdesk.generated.AgentProperties;
import com.example.claimsdesk.generated.cache.ReplyCache;
import com.example.claimsdesk.generated.guard.Guardrails;
import com.example.claimsdesk.generated.limits.UsageLimits;
import com.example.claimsdesk.generated.privacy.PersonalData;
import com.example.claimsdesk.generated.resilience.ModelUnavailableException;
import com.example.claimsdesk.generated.switches.AgentSwitchedOffException;
import com.example.claimsdesk.generated.switches.KillSwitches;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.stereotype.Service;

/**
 * Sends a user message to the model within its conversation, so earlier messages are remembered. Conversations are
 * kept under their user: nobody can read or continue someone else's.
 */
@Service
public class ChatService {

    private final ChatClient chatClient;

    private final ChatMemory chatMemory;

    private final UsageLimits usageLimits;

    private final ReplyCache replyCache;

    private final PersonalData personalData;

    private final Guardrails guardrails;

    private final ModelRouter modelRouter;

    private final KillSwitches killSwitches;

    private final String fallbackAnswer;

    ChatService(
        ChatClient chatClient,
        ChatMemory chatMemory,
        UsageLimits usageLimits,
        ReplyCache replyCache,
        PersonalData personalData,
        Guardrails guardrails,
        ModelRouter modelRouter,
        KillSwitches killSwitches,
        AgentProperties properties
    ) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
        this.usageLimits = usageLimits;
        this.replyCache = replyCache;
        this.personalData = personalData;
        this.guardrails = guardrails;
        this.modelRouter = modelRouter;
        this.killSwitches = killSwitches;
        this.fallbackAnswer = properties.fallbackAnswer();
    }

    ChatMessageResponse reply(ChatMessageRequest request, String userId) {
        if (killSwitches.agentOff()) {
            throw new AgentSwitchedOffException();
        }
        usageLimits.checkRequest(userId);
        String conversationId =
            request.conversationId() != null ? request.conversationId() : UUID.randomUUID().toString();
        String memoryKey = memoryKeyOf(userId, conversationId);
        if (request.conversationId() != null && chatMemory.get(memoryKey).isEmpty()) {
            throw new UnknownConversationException(conversationId);
        }
        Optional<String> refusal = guardrails.refusalFor(request.message());
        if (refusal.isPresent()) {
            // Nothing is kept of a refused message: a conversation it would have started does not exist.
            return new ChatMessageResponse(request.conversationId(), refusal.get());
        }
        // The model, the memory and the caches only ever see tokens in place of personal data.
        String message = personalData.mask(memoryKey, request.message());
        boolean firstMessage = request.conversationId() == null;
        if (firstMessage) {
            Optional<String> cached = replyCache.find(userId, message);
            if (cached.isPresent()) {
                // Kept in the conversation as if the model had answered, so that it can go on from there.
                chatMemory.add(memoryKey, List.of(new UserMessage(message), new AssistantMessage(cached.get())));
                return new ChatMessageResponse(conversationId, cached.get());
            }
        }
        String answer;
        try {
            ChatResponse response = chatClient
                .prompt()
                .user(message)
                .options(ChatOptions.builder().model(modelRouter.modelFor(message)))
                .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, memoryKey))
                .call()
                .chatResponse();
            usageLimits.recordTokens(userId, response.getMetadata().getUsage().getTotalTokens());
            answer = response.getResult().getOutput().getText();
        } catch (ModelUnavailableException unavailable) {
            // No model could answer: the user gets the fallback answer, which nothing keeps.
            return new ChatMessageResponse(conversationId, fallbackAnswer);
        }
        // Checked before anything else sees it: the caches, the user.
        answer = guardrails.check(answer);
        // Never reused: an empty answer, one about personal data.
        if (
            firstMessage &&
            !answer.isBlank() &&
            !PersonalData.containsTokens(message) &&
            !PersonalData.containsTokens(answer)
        ) {
            replyCache.put(userId, message, answer);
        }
        return new ChatMessageResponse(conversationId, personalData.restore(memoryKey, answer));
    }

    /** Throws {@link UnknownConversationException} unless the user has this conversation. */
    public void requireConversation(String userId, String conversationId) {
        if (chatMemory.get(memoryKeyOf(userId, conversationId)).isEmpty()) {
            throw new UnknownConversationException(conversationId);
        }
    }

    // Stored under a key of its user: another user's conversation id leads nowhere. A name-based UUID keeps the key
    // within the 36 characters of Spring AI's memory table.
    private static String memoryKeyOf(String userId, String conversationId) {
        return UUID.nameUUIDFromBytes((userId + ":" + conversationId).getBytes(StandardCharsets.UTF_8)).toString();
    }
}
