// Managed by gen-agent: changes here are overwritten.
package com.example.docsanalyst.generated.chat;

import com.example.docsanalyst.generated.rag.KnowledgeBase;
import java.util.List;
import java.util.UUID;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.stereotype.Service;

/** Sends a user message to the model within its conversation, so earlier messages are remembered. */
@Service
class ChatService {

    private final ChatClient chatClient;

    private final KnowledgeBase knowledgeBase;

    ChatService(ChatClient chatClient, KnowledgeBase knowledgeBase) {
        this.chatClient = chatClient;
        this.knowledgeBase = knowledgeBase;
    }

    ChatMessageResponse reply(ChatMessageRequest request) {
        String conversationId =
            request.conversationId() != null ? request.conversationId() : UUID.randomUUID().toString();
        String message = request.message();
        // The passages of the knowledge base reach the model as data, never the memory of the conversation.
        List<Message> passages = knowledgeBase
            .contextFor(message)
            .map(context -> List.<Message>of(new SystemMessage(context)))
            .orElse(List.of());
        String answer = chatClient
            .prompt()
            .user(message)
            .messages(passages)
            .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, conversationId))
            .call()
            .content();
        return new ChatMessageResponse(conversationId, answer);
    }
}
