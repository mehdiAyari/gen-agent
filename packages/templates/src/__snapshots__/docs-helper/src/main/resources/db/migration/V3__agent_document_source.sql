-- Managed by gen-agent: the documents of the knowledge base and the fingerprint of the version indexed, so that only
-- changed documents are indexed again. Their passages are in agent_document, the table of the vector store.
CREATE TABLE agent_document_source (
    source VARCHAR(1024) PRIMARY KEY,
    fingerprint VARCHAR(64) NOT NULL,
    passages INTEGER NOT NULL,
    indexed_at TIMESTAMPTZ NOT NULL
);
