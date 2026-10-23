// Managed by gen-agent: changes here are overwritten. Implement the tool in DefaultRefundHandler.
package com.example.supportdesk.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/** Exposes {@code refund} to the model and delegates the work to {@link RefundHandler}. */
@Component
public class RefundTool {

    private final RefundHandler handler;

    private final ToolCalls toolCalls;

    RefundTool(RefundHandler handler, ToolCalls toolCalls) {
        this.handler = handler;
        this.toolCalls = toolCalls;
    }

    @Tool(description = "Refunds an order of the customer")
    public String refund(String orderId) {
        Objects.requireNonNull(orderId, "orderId is required");
        toolCalls.record();
        return handler.refund(orderId);
    }
}
