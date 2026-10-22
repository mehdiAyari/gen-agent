// Managed by gen-agent: changes here are overwritten. Implement the tool in DefaultCurrentTimeHandler.
package io.acme.agents.local.generated.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/** Exposes {@code current-time} to the model and delegates the work to {@link CurrentTimeHandler}. */
@Component
public class CurrentTimeTool {

    private final CurrentTimeHandler handler;

    CurrentTimeTool(CurrentTimeHandler handler) {
        this.handler = handler;
    }

    @Tool(description = "Current date and time of the server")
    public String currentTime() {
        return handler.currentTime();
    }
}
