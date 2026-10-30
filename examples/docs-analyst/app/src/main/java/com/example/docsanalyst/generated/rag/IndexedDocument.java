// Managed by gen-agent: changes here are overwritten.
package com.example.docsanalyst.generated.rag;

import java.time.Instant;

/**
 * A document of the knowledge base.
 *
 * @param source its name: its path in the documents folder, or upload/ and its file name
 * @param passages how many passages it was split into
 * @param indexedAt when this version was indexed
 */
public record IndexedDocument(String source, int passages, Instant indexedAt) {}
