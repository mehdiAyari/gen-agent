// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.approval;

import java.time.Instant;
import java.util.UUID;

/**
 * A tool call that waits for the approval of the user who asked.
 *
 * @param id what the user approves or denies, with POST /api/approvals/{id}
 * @param tool the tool the model wants to call
 * @param arguments what the model wants to call it with, as JSON
 * @param expiresAt after this, the call can no longer be approved
 */
public record PendingApproval(UUID id, String tool, String arguments, Instant expiresAt) {}
