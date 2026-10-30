// Managed by gen-agent: changes here are overwritten. Implement the tool in DefaultAccountBalanceHandler.
package com.example.bankdesk.generated.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/** Exposes {@code account-balance} to the model and delegates the work to {@link AccountBalanceHandler}. */
@Component
public class AccountBalanceTool {

    private final AccountBalanceHandler handler;

    AccountBalanceTool(AccountBalanceHandler handler) {
        this.handler = handler;
    }

    @Tool(description = "Balance of the account of the signed-in customer, in euros")
    public String accountBalance() {
        return handler.accountBalance();
    }
}
