// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.tool;

import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;

/** A tool of the model, called through {@link ToolGuard}. */
class GuardedToolCallback implements ToolCallback {

    private final ToolCallback delegate;

    private final ToolGuard guard;

    GuardedToolCallback(ToolCallback delegate, ToolGuard guard) {
        this.delegate = delegate;
        this.guard = guard;
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
        return guard.afterCall(delegate.call(guard.beforeCall(toolInput)));
    }

    @Override
    public String call(String toolInput, ToolContext toolContext) {
        return guard.afterCall(delegate.call(guard.beforeCall(toolInput), toolContext));
    }
}
