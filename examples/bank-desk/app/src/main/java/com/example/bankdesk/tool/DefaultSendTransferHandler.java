package com.example.bankdesk.tool;

import com.example.bankdesk.generated.tool.SendTransferHandler;
import org.springframework.stereotype.Component;

/**
 * Runs once the customer approved the call. The IBAN arrives as the customer typed it: the model only ever saw a token
 * such as [IBAN_1], put back in the arguments by gen-agent before this method is called.
 */
@Component
class DefaultSendTransferHandler implements SendTransferHandler {

    private final Accounts accounts;

    DefaultSendTransferHandler(Accounts accounts) {
        this.accounts = accounts;
    }

    @Override
    public String sendTransfer(String iban, Double amount) {
        return accounts.send(iban, amount);
    }
}
