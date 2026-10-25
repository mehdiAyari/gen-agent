// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.rag;

import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** For the agent-admin role: the documents of the knowledge base, beside those of the documents folder. */
@RestController
@RequestMapping("/api/admin/documents")
class DocumentController {

    /** Where uploaded documents are kept, apart from the files of the documents folder. */
    static final String UPLOADS = "upload/";

    private final KnowledgeBase knowledgeBase;

    DocumentController(KnowledgeBase knowledgeBase) {
        this.knowledgeBase = knowledgeBase;
    }

    @GetMapping
    List<IndexedDocument> documents() {
        return knowledgeBase.documents();
    }

    /** Indexes the file, in place of an earlier upload of the same name. */
    @PostMapping
    ResponseEntity<IndexedDocument> upload(@RequestParam MultipartFile file) throws IOException {
        String name = StringUtils.getFilename(file.getOriginalFilename());
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String source = UPLOADS + name;
        knowledgeBase.index(source, file.getResource());
        return ResponseEntity.status(HttpStatus.CREATED).body(
            knowledgeBase
                .documents()
                .stream()
                .filter(document -> document.source().equals(source))
                .findFirst()
                .orElseThrow()
        );
    }

    @DeleteMapping
    ResponseEntity<Void> forget(@RequestParam String source) {
        return knowledgeBase.forget(source) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
