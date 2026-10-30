// Managed by gen-agent: changes here are overwritten. Implement the tool in DefaultSendTransferHandler.
package com.example.bankdesk.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/** Exposes {@code send-transfer} to the model and delegates the work to {@link SendTransferHandler}. */
@Component
public class SendTransferTool {

    private final SendTransferHandler handler;

    SendTransferTool(SendTransferHandler handler) {
        this.handler = handler;
    }

    @Tool(description = "Sends a transfer from the account of the signed-in customer")
    public String sendTransfer(
        @ToolParam(description = "the IBAN of the recipient, as the customer wrote it") String iban,
        @ToolParam(description = "the amount, in euros") Double amount
    ) {
        Objects.requireNonNull(iban, "iban is required");
        Objects.requireNonNull(amount, "amount is required");
        return handler.sendTransfer(iban, amount);
    }
}
