// Managed by gen-agent: changes here are overwritten.
package com.example.ticketbot.generated.chat;

import java.util.UUID;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.stereotype.Service;

/** Sends a user message to the model within its conversation, so earlier messages are remembered. */
@Service
class ChatService {

    private final ChatClient chatClient;

    ChatService(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    ChatMessageResponse reply(ChatMessageRequest request) {
        String conversationId =
            request.conversationId() != null ? request.conversationId() : UUID.randomUUID().toString();
        String reply = chatClient
            .prompt()
            .user(request.message())
            .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, conversationId))
            .call()
            .content();
        return new ChatMessageResponse(conversationId, reply);
    }
}
