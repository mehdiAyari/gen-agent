// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.tool;

import java.util.Arrays;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Component;

/**
 * Every tool of the model, generated or from an MCP server, goes through here. An answer built from a tool depends
 * on live data: the cache does not keep it. Tools run on the thread of the request, whose state is kept here.
 */
@Component
public class ToolGuard {

    private final ThreadLocal<Boolean> called = ThreadLocal.withInitial(() -> false);

    /** Before asking the model. */
    public void start() {
        called.set(false);
    }

    public boolean toolCalled() {
        return called.get();
    }

    public ToolCallback[] guard(ToolCallback[] callbacks) {
        return Arrays.stream(callbacks)
            .map(callback -> new GuardedToolCallback(callback, this))
            .toArray(ToolCallback[]::new);
    }

    String beforeCall(String input) {
        called.set(true);
        return input;
    }
}
