// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.Test;

class RefundToolTests {

    @Test
    void delegatesToTheHandler() {
        RefundTool tool = new RefundTool(orderId -> "handled");

        assertThat(tool.refund("test")).isEqualTo("handled");
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        RefundTool tool = new RefundTool(orderId -> "handled");

        assertThatNullPointerException()
            .isThrownBy(() -> tool.refund(null))
            .withMessage("orderId is required");
    }
}
