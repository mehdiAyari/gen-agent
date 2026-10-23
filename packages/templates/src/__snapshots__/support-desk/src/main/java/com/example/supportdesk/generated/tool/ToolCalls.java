// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.tool;

import java.util.Arrays;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Component;

/**
 * Whether the model called a tool while answering the current request: such an answer depends on live data, so it is
 * not cached. Tools run on the thread of the request, which this keeps apart from the others.
 */
@Component
public class ToolCalls {

    private final ThreadLocal<Boolean> called = ThreadLocal.withInitial(() -> false);

    /** Before asking the model. */
    public void start() {
        called.set(false);
    }

    public boolean happened() {
        return called.get();
    }

    void record() {
        called.set(true);
    }

    /** The tools of the MCP servers, reporting their calls here like the generated ones. */
    public ToolCallback[] recorded(ToolCallback[] callbacks) {
        return Arrays.stream(callbacks)
            .map(callback -> new RecordedToolCallback(callback, this))
            .toArray(ToolCallback[]::new);
    }
}
