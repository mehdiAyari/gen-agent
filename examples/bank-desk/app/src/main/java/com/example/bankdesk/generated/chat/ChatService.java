// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.chat;

import com.example.bankdesk.generated.AgentProperties;
import com.example.bankdesk.generated.approval.Approvals;
import com.example.bankdesk.generated.approval.PendingApproval;
import com.example.bankdesk.generated.cache.ReplyCache;
import com.example.bankdesk.generated.cache.SemanticCache;
import com.example.bankdesk.generated.guard.Guardrails;
import com.example.bankdesk.generated.limits.UsageLimits;
import com.example.bankdesk.generated.privacy.Conversations;
import com.example.bankdesk.generated.privacy.PersonalData;
import com.example.bankdesk.generated.resilience.ModelUnavailableException;
import com.example.bankdesk.generated.switches.AgentSwitchedOffException;
import com.example.bankdesk.generated.switches.KillSwitches;
import com.example.bankdesk.generated.tool.ToolGuard;
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

    private final Approvals approvals;

    private final KillSwitches killSwitches;

    private final String fallbackAnswer;

    ChatService(
        ChatClient chatClient,
        ChatMemory chatMemory,
        UsageLimits usageLimits,
        ReplyCache replyCache,
        ToolGuard toolGuard,
        SemanticCache semanticCache,
        PersonalData personalData,
        Conversations conversations,
        Guardrails guardrails,
        Approvals approvals,
        KillSwitches killSwitches,
        AgentProperties properties
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
        this.approvals = approvals;
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
        toolGuard.start(memoryKey, userId, conversationId);
        String answer;
        try {
            ChatResponse response = chatClient
                .prompt()
                .user(message)
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
        // Never reused: an empty answer, one built from a tool, which depends on live data, one about personal data.
        if (
            firstMessage &&
            !answer.isBlank() &&
            !toolGuard.toolCalled() &&
            !PersonalData.containsTokens(message) &&
            !PersonalData.containsTokens(answer)
        ) {
            replyCache.put(userId, message, answer);
            semanticCache.put(userId, message, answer);
        }
        return new ChatMessageResponse(conversationId, personalData.restore(memoryKey, answer), waiting(memoryKey));
    }

    List<PendingApproval> pendingApprovals(String userId) {
        return approvals.pendingOf(userId, personalData::restore);
    }

    /** Makes the call the user approved, or not, tells the model, and returns its next answer. */
    ChatMessageResponse decide(UUID approvalId, boolean approved, String userId) {
        if (killSwitches.agentOff()) {
            throw new AgentSwitchedOffException();
        }
        usageLimits.checkRequest(userId);
        Approvals.Approval approval = approvals.decide(approvalId, userId, approved);
        String memoryKey = approval.conversationKey();
        String conversationId = approval.conversationId();
        toolGuard.start(memoryKey, userId, conversationId);
        // Told to the model as a message of the conversation, so that it goes on from there.
        String message = approved
            ? "The user approved the call to " +
              approval.tool() +
              ": it is done, do not make it again. It returned:\n" +
              toolGuard.callApproved(approval.tool(), approval.arguments())
            : "The user denied the call to " +
              approval.tool() +
              ": it was not made. Do not make it again unless they ask.";
        String answer;
        try {
            ChatResponse response = chatClient
                .prompt()
                .user(message)
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
        return new ChatMessageResponse(conversationId, personalData.restore(memoryKey, answer), waiting(memoryKey));
    }

    /** The calls of this answer that wait for the user, with the personal data they hold. */
    private List<PendingApproval> waiting(String memoryKey) {
        return toolGuard
            .pendingApprovals()
            .stream()
            .map(approval ->
                new PendingApproval(
                    approval.id(),
                    approval.tool(),
                    personalData.restore(memoryKey, approval.arguments()),
                    approval.expiresAt()
                )
            )
            .toList();
    }
}
