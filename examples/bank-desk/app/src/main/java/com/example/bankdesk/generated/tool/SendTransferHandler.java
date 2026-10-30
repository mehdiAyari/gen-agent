// Managed by gen-agent: changes here are overwritten. Implement it in DefaultSendTransferHandler.
package com.example.bankdesk.generated.tool;

/**
 * Business logic of the {@code send-transfer} tool; the returned text is sent back to the model.
 * Required arguments are checked before this method is called; optional ones may be {@code null}.
 */
public interface SendTransferHandler {
    String sendTransfer(String iban, Double amount);
}
