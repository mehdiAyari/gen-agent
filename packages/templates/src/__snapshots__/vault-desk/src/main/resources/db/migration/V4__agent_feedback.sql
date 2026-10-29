-- Managed by gen-agent: what users think of the answers, to read the ones rated down.
CREATE TABLE agent_feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255) NOT NULL,
    rating VARCHAR(4) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX agent_feedback_rating ON agent_feedback (rating, created_at);
