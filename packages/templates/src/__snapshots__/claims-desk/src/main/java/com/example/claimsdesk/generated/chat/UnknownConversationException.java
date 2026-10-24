// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated.chat;

/** The conversation does not exist for this user, whether it was never started or belongs to someone else. */
class UnknownConversationException extends RuntimeException {

    UnknownConversationException(String conversationId) {
        super("No conversation " + conversationId);
    }
}
