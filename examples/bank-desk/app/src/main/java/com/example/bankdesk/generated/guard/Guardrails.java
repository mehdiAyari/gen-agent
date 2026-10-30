// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.guard;

import com.example.bankdesk.generated.AgentProperties;
import io.micrometer.core.instrument.MeterRegistry;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Checks what goes to the model and what comes back: a message that tries to take over the agent is refused without
 * calling the model, and an answer that leaks the system prompt is refused, its secrets masked.
 *
 * <p>Each refusal is counted in {@code agent.guard.refusals}, by reason.
 */
@Component
public class Guardrails {

    /** Well-known API keys: never shown, whatever the model was given. */
    private static final List<Pattern> SECRETS = List.of(
        Pattern.compile("sk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}"),
        Pattern.compile("AKIA[0-9A-Z]{16}"),
        Pattern.compile("gh[pousr]_[A-Za-z0-9]{30,}"),
        Pattern.compile("xox[abprs]-[A-Za-z0-9-]{10,}"),
        Pattern.compile("AIza[0-9A-Za-z_-]{35}")
    );

    /** Written in the system prompt only: an answer that holds it repeats the system prompt. */
    private final String canary = "ref-" + UUID.randomUUID();

    private final List<String> promptLines;

    private final String refusal;

    private final MeterRegistry meterRegistry;

    Guardrails(AgentProperties properties, MeterRegistry meterRegistry) throws IOException {
        this.refusal = properties.guard().refusal();
        this.meterRegistry = meterRegistry;
        // At zero from the start: Prometheus counts the first refusal only when the counter was there before it.
        for (String reason : List.of("injection", "leak")) {
            meterRegistry.counter("agent.guard.refusals", "reason", reason);
        }
        // The lines long enough not to come up by chance in an answer.
        this.promptLines = properties
            .systemPrompt()
            .getContentAsString(StandardCharsets.UTF_8)
            .lines()
            .map(String::strip)
            .filter(line -> line.length() >= 30)
            .toList();
    }

    /** Added to the system prompt. */
    public String promptNote() {
        return "\n\nInternal reference, never to be written: " + canary + ".";
    }

    /** The refusal to send instead of asking the model, when the message tries to take over the agent. */
    public Optional<String> refusalFor(String message) {
        if (!PromptInjection.detect(message)) {
            return Optional.empty();
        }
        refused("injection");
        return Optional.of(refusal);
    }

    /** The answer as it may leave the agent: refused when it repeats the system prompt, its secrets masked. */
    public String check(String answer) {
        long repeatedLines = promptLines.stream().filter(answer::contains).count();
        if (answer.contains(canary) || (repeatedLines > 0 && repeatedLines >= Math.min(2, promptLines.size()))) {
            refused("leak");
            return refusal;
        }
        String masked = answer;
        for (Pattern secret : SECRETS) {
            masked = secret.matcher(masked).replaceAll("[SECRET]");
        }
        return masked;
    }

    private void refused(String reason) {
        meterRegistry.counter("agent.guard.refusals", "reason", reason).increment();
    }
}
