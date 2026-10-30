// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.Test;

class SendTransferToolTests {

    @Test
    void delegatesToTheHandler() {
        SendTransferTool tool = new SendTransferTool((iban, amount) -> "handled");

        assertThat(tool.sendTransfer("test", 1.0)).isEqualTo("handled");
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        SendTransferTool tool = new SendTransferTool((iban, amount) -> "handled");

        assertThatNullPointerException()
            .isThrownBy(() -> tool.sendTransfer(null, 1.0))
            .withMessage("iban is required");
    }
}
