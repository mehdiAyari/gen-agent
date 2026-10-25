// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.rag;

import com.example.vaultdesk.generated.AgentProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Component;

/**
 * Indexes the documents folder ({@code agent.rag.documents}) once the agent is ready: new and changed files are
 * indexed, files that are gone are forgotten, uploaded documents are kept.
 */
@Component
class DocumentFolder {

    private static final Logger log = LoggerFactory.getLogger(DocumentFolder.class);

    private final KnowledgeBase knowledgeBase;

    private final Path folder;

    DocumentFolder(KnowledgeBase knowledgeBase, AgentProperties properties) {
        this.knowledgeBase = knowledgeBase;
        this.folder = properties.rag().documents();
    }

    @EventListener(ApplicationReadyEvent.class)
    void index() throws IOException {
        if (!Files.isDirectory(folder)) {
            log.warn("No documents folder at {}: the knowledge base keeps what it has", folder.toAbsolutePath());
            return;
        }
        Set<String> present = new HashSet<>();
        try (Stream<Path> files = Files.walk(folder)) {
            for (Path file : files.filter(Files::isRegularFile).toList()) {
                String source = folder.relativize(file).toString().replace('\\', '/');
                present.add(source);
                knowledgeBase.index(source, new FileSystemResource(file));
            }
        }
        for (IndexedDocument document : knowledgeBase.documents()) {
            if (!present.contains(document.source()) && !document.source().startsWith(DocumentController.UPLOADS)) {
                knowledgeBase.forget(document.source());
                log.info("Forgot {}: it is no longer in the documents folder", document.source());
            }
        }
    }
}
