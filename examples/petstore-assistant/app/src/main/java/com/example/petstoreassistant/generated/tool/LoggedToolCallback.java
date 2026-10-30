// Managed by gen-agent: changes here are overwritten.
package com.example.petstoreassistant.generated.tool;

import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;

/**
 * A tool of the model whose calls are logged: the tool, how long it took and whether it failed. Never its arguments nor
 * its result, which may hold personal data: the traces keep the whole exchange.
 */
public final class LoggedToolCallback implements ToolCallback {

    private static final Logger log = LoggerFactory.getLogger(LoggedToolCallback.class);

    private final ToolCallback delegate;

    private LoggedToolCallback(ToolCallback delegate) {
        this.delegate = delegate;
    }

    public static ToolCallback[] logged(ToolCallback[] tools) {
        return Arrays.stream(tools)
            .map(LoggedToolCallback::new)
            .toArray(ToolCallback[]::new);
    }

    @Override
    public ToolDefinition getToolDefinition() {
        return delegate.getToolDefinition();
    }

    @Override
    public ToolMetadata getToolMetadata() {
        return delegate.getToolMetadata();
    }

    @Override
    public String call(String toolInput) {
        return logged(() -> delegate.call(toolInput));
    }

    @Override
    public String call(String toolInput, ToolContext toolContext) {
        return logged(() -> delegate.call(toolInput, toolContext));
    }

    private String logged(Supplier<String> call) {
        String name = getToolDefinition().name();
        long start = System.nanoTime();
        try {
            String result = call.get();
            log.info("Tool {} answered in {} ms", name, millisSince(start));
            return result;
        } catch (RuntimeException e) {
            log.warn("Tool {} failed after {} ms: {}", name, millisSince(start), e.getClass().getSimpleName());
            throw e;
        }
    }

    private static long millisSince(long start) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
    }
}
