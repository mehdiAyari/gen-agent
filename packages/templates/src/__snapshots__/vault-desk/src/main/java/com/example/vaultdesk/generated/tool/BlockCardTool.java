// Managed by gen-agent: changes here are overwritten. Implement the tool in DefaultBlockCardHandler.
package com.example.vaultdesk.generated.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/** Exposes {@code block-card} to the model and delegates the work to {@link BlockCardHandler}. */
@Component
public class BlockCardTool {

    private final BlockCardHandler handler;

    BlockCardTool(BlockCardHandler handler) {
        this.handler = handler;
    }

    @Tool(description = "Blocks the payment card of the customer")
    public String blockCard() {
        return handler.blockCard();
    }
}
