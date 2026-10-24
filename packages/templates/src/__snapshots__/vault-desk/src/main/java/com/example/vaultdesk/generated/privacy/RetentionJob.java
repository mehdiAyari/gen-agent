// Managed by gen-agent: changes here are overwritten. Set the retention in application.yml.
package com.example.vaultdesk.generated.privacy;

import com.example.vaultdesk.generated.AgentProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Every hour, erases the conversations unused for longer than {@code agent.memory.retention}. */
@Component
public class RetentionJob {

    private static final Logger log = LoggerFactory.getLogger(RetentionJob.class);

    private final Conversations conversations;

    private final DataEraser eraser;

    private final Duration retention;

    RetentionJob(Conversations conversations, DataEraser eraser, AgentProperties properties) {
        this.conversations = conversations;
        this.eraser = eraser;
        this.retention = properties.memory().retention();
    }

    @Scheduled(cron = "0 0 * * * *")
    public void purge() {
        List<String> expired = conversations.unusedSince(Instant.now().minus(retention));
        for (String memoryKey : expired) {
            eraser.eraseConversation(memoryKey);
        }
        if (!expired.isEmpty()) {
            log.info("Purged {} conversations unused for {}", expired.size(), retention);
        }
    }
}
