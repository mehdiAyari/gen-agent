// Managed by gen-agent: changes here are overwritten.
package io.acme.agents.local.generated.chat;

/**
 * The agent's reply.
 *
 * @param conversationId conversation to send with the next message to keep the context
 * @param reply what the agent answers
 */
record ChatMessageResponse(String conversationId, String reply) {}
