// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.privacy;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Which user each conversation belongs to, and when it was last used (table agent_conversation). */
@Repository
public class Conversations {

    private final JdbcClient jdbc;

    Conversations(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void touch(String memoryKey, String userId) {
        jdbc.sql(
            """
            INSERT INTO agent_conversation (memory_key, user_id, last_used_at) VALUES (?, ?, now())
            ON CONFLICT (memory_key) DO UPDATE SET last_used_at = now()
            """
        )
            .params(memoryKey, userId)
            .update();
    }

    public List<String> of(String userId) {
        return jdbc
            .sql("SELECT memory_key FROM agent_conversation WHERE user_id = ?")
            .param(userId)
            .query(String.class)
            .list();
    }

    public List<String> unusedSince(Instant moment) {
        return jdbc
            .sql("SELECT memory_key FROM agent_conversation WHERE last_used_at < ?")
            .param(Timestamp.from(moment))
            .query(String.class)
            .list();
    }

    public void delete(String memoryKey) {
        jdbc.sql("DELETE FROM agent_conversation WHERE memory_key = ?").param(memoryKey).update();
    }
}
