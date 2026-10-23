// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.tool;

import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;

/** A tool of an MCP server that reports its calls to {@link ToolCalls}. */
class RecordedToolCallback implements ToolCallback {

    private final ToolCallback delegate;

    private final ToolCalls toolCalls;

    RecordedToolCallback(ToolCallback delegate, ToolCalls toolCalls) {
        this.delegate = delegate;
        this.toolCalls = toolCalls;
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
        toolCalls.record();
        return delegate.call(toolInput);
    }

    @Override
    public String call(String toolInput, ToolContext toolContext) {
        toolCalls.record();
        return delegate.call(toolInput, toolContext);
    }
}
