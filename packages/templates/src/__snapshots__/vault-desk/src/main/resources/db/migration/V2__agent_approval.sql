-- Managed by gen-agent: tool calls that wait for the approval of the user who asked, until approved, denied or
-- expired.
CREATE TABLE agent_approval (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    conversation_key VARCHAR(36) NOT NULL,
    conversation_id VARCHAR(255) NOT NULL,
    tool VARCHAR(255) NOT NULL,
    arguments TEXT NOT NULL,
    status VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX agent_approval_user ON agent_approval (user_id, status);
