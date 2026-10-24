// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.chat;

import com.example.vaultdesk.generated.approval.PendingApproval;
import java.util.List;

/**
 * The agent's reply.
 *
 * @param conversationId conversation to send with the next message to keep the context
 * @param reply what the agent answers
 * @param aiGenerated always {@code true}: tells clients the reply comes from an AI, as the EU AI Act requires
 * @param approvals the tool calls of this reply that wait for the user's approval
 */
record ChatMessageResponse(String conversationId, String reply, boolean aiGenerated, List<PendingApproval> approvals) {
    ChatMessageResponse(String conversationId, String reply) {
        this(conversationId, reply, true, List.of());
    }

    ChatMessageResponse(String conversationId, String reply, List<PendingApproval> approvals) {
        this(conversationId, reply, true, approvals);
    }
}
