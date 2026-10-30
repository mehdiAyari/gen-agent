// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.chat;

import com.example.hrassistant.generated.approval.Approvals;
import com.example.hrassistant.generated.approval.PendingApproval;
import com.example.hrassistant.generated.cache.ReplyCache;
import com.example.hrassistant.generated.limits.UsageLimits;
import com.example.hrassistant.generated.tool.ToolGuard;
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

    private final Approvals approvals;

    ChatService(
        ChatClient chatClient,
        ChatMemory chatMemory,
        UsageLimits usageLimits,
        ReplyCache replyCache,
        ToolGuard toolGuard,
        Approvals approvals
    ) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
        this.usageLimits = usageLimits;
        this.replyCache = replyCache;
        this.toolGuard = toolGuard;
        this.approvals = approvals;
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
        toolGuard.start(memoryKey, userId, conversationId);
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
        return new ChatMessageResponse(conversationId, answer, toolGuard.pendingApprovals());
    }

    List<PendingApproval> pendingApprovals(String userId) {
        return approvals.pendingOf(userId);
    }

    /** Makes the call the user approved, or not, tells the model, and returns its next answer. */
    ChatMessageResponse decide(UUID approvalId, boolean approved, String userId) {
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
        ChatResponse response = chatClient
            .prompt()
            .user(message)
            .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, memoryKey))
            .call()
            .chatResponse();
        usageLimits.recordTokens(userId, response.getMetadata().getUsage().getTotalTokens());
        String answer = response.getResult().getOutput().getText();
        return new ChatMessageResponse(conversationId, answer, toolGuard.pendingApprovals());
    }

    // Stored under a key of its user: another user's conversation id leads nowhere. A name-based UUID keeps the key
    // within the 36 characters of Spring AI's memory table.
    private static String memoryKeyOf(String userId, String conversationId) {
        return UUID.nameUUIDFromBytes((userId + ":" + conversationId).getBytes(StandardCharsets.UTF_8)).toString();
    }
}
