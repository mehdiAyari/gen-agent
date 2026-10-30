// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AccountBalanceToolTests {

    @Test
    void delegatesToTheHandler() {
        AccountBalanceTool tool = new AccountBalanceTool(() -> "handled");

        assertThat(tool.accountBalance()).isEqualTo("handled");
    }
}
