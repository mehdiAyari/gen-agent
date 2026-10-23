// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A message sent to the agent.
 *
 * @param conversationId conversation to continue; a new one is started when absent
 * @param message what the user says
 */
record ChatMessageRequest(@Size(max = 100) String conversationId, @NotBlank @Size(max = 4000) String message) {}
