// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.approval;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BinaryOperator;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Tool calls that wait for approval, kept in the {@code agent_approval} table until approved, denied or expired. */
@Component
public class Approvals {

    /** What the agent needs to make the call and go on with the conversation once approved. */
    public record Approval(String conversationKey, String conversationId, String tool, String arguments) {}

    private final JdbcClient jdbc;

    Approvals(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public PendingApproval request(
        String userId,
        String conversationKey,
        String conversationId,
        String tool,
        String arguments,
        Duration expiresAfter
    ) {
        UUID id = UUID.randomUUID();
        Instant expiresAt = Instant.now().plus(expiresAfter);
        jdbc.sql(
            """
            INSERT INTO agent_approval (id, user_id, conversation_key, conversation_id, tool, arguments, status, expires_at)
            VALUES (:id, :user, :key, :conversation, :tool, :arguments, 'PENDING', :expiresAt)
            """
        )
            .param("id", id)
            .param("user", userId)
            .param("key", conversationKey)
            .param("conversation", conversationId)
            .param("tool", tool)
            .param("arguments", arguments)
            .param("expiresAt", Timestamp.from(expiresAt))
            .update();
        return new PendingApproval(id, tool, arguments, expiresAt);
    }

    /** The calls that still wait for the user; {@code reveal} puts the personal data back in their arguments. */
    public List<PendingApproval> pendingOf(String userId, BinaryOperator<String> reveal) {
        return jdbc
            .sql(
                """
                SELECT id, tool, arguments, conversation_key, expires_at FROM agent_approval
                WHERE user_id = :user AND status = 'PENDING' AND expires_at > now()
                ORDER BY expires_at
                """
            )
            .param("user", userId)
            .query((row, number) ->
                new PendingApproval(
                    row.getObject("id", UUID.class),
                    row.getString("tool"),
                    reveal.apply(row.getString("conversation_key"), row.getString("arguments")),
                    row.getTimestamp("expires_at").toInstant()
                )
            )
            .list();
    }

    /** Records the decision of the user, once: another user, a second answer or a late one is refused. */
    public Approval decide(UUID id, String userId, boolean approved) {
        Optional<Approval> decided = jdbc
            .sql(
                """
                UPDATE agent_approval SET status = :status
                WHERE id = :id AND user_id = :user AND status = 'PENDING' AND expires_at > now()
                RETURNING conversation_key, conversation_id, tool, arguments
                """
            )
            .param("status", approved ? "APPROVED" : "DENIED")
            .param("id", id)
            .param("user", userId)
            .query((row, number) ->
                new Approval(
                    row.getString("conversation_key"),
                    row.getString("conversation_id"),
                    row.getString("tool"),
                    row.getString("arguments")
                )
            )
            .optional();
        return decided.orElseThrow(() -> unavailable(id, userId));
    }

    public void forget(String userId) {
        jdbc.sql("DELETE FROM agent_approval WHERE user_id = :user").param("user", userId).update();
    }

    private ApprovalUnavailableException unavailable(UUID id, String userId) {
        Optional<String> status = jdbc
            .sql(
                """
                SELECT CASE WHEN status <> 'PENDING' THEN status ELSE 'EXPIRED' END
                FROM agent_approval WHERE id = :id AND user_id = :user
                """
            )
            .param("id", id)
            .param("user", userId)
            .query(String.class)
            .optional();
        return (
            status
                .map(value ->
                    "EXPIRED".equals(value)
                        ? new ApprovalUnavailableException(HttpStatus.GONE, "This request has expired: ask again.")
                        : new ApprovalUnavailableException(HttpStatus.CONFLICT, "This request was already answered.")
                )
                // Someone else's request leads nowhere, as if it did not exist.
                .orElseGet(() -> new ApprovalUnavailableException(HttpStatus.NOT_FOUND, "No such request."))
        );
    }
}
