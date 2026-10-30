package com.example.bankdesk.tool;

import com.example.bankdesk.generated.tool.AccountBalanceHandler;
import org.springframework.stereotype.Component;

@Component
class DefaultAccountBalanceHandler implements AccountBalanceHandler {

    private final Accounts accounts;

    DefaultAccountBalanceHandler(Accounts accounts) {
        this.accounts = accounts;
    }

    @Override
    public String accountBalance() {
        return "Balance: " + accounts.balance() + " euros.";
    }
}
