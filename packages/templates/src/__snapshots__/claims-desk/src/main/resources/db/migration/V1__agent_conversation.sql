-- Managed by gen-agent: which user each conversation belongs to and when it was last used, so that conversations can
-- be erased per user and purged once unused. Spring AI keeps the messages in its own table.
CREATE TABLE agent_conversation (
    memory_key VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX agent_conversation_user_id ON agent_conversation (user_id);
CREATE INDEX agent_conversation_last_used_at ON agent_conversation (last_used_at);
