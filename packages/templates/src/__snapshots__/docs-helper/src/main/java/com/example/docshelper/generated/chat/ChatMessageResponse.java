// Managed by gen-agent: changes here are overwritten.
package com.example.docshelper.generated.chat;

/**
 * The agent's reply.
 *
 * @param conversationId conversation to send with the next message to keep the context
 * @param reply what the agent answers
 * @param aiGenerated always {@code true}: tells clients the reply comes from an AI, as the EU AI Act requires
 */
record ChatMessageResponse(String conversationId, String reply, boolean aiGenerated) {
    ChatMessageResponse(String conversationId, String reply) {
        this(conversationId, reply, true);
    }
}
