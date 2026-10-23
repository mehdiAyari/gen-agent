// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.Test;

class RefundToolTests {

    @Test
    void delegatesToTheHandler() {
        RefundTool tool = new RefundTool(orderId -> "handled", new ToolCalls());

        assertThat(tool.refund("test")).isEqualTo("handled");
    }

    @Test
    void reportsItsCallSoTheAnswerIsNotCached() {
        ToolCalls toolCalls = new ToolCalls();
        RefundTool tool = new RefundTool(orderId -> "handled", toolCalls);
        toolCalls.start();

        tool.refund("test");

        assertThat(toolCalls.happened()).isTrue();
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        RefundTool tool = new RefundTool(orderId -> "handled", new ToolCalls());

        assertThatNullPointerException()
            .isThrownBy(() -> tool.refund(null))
            .withMessage("orderId is required");
    }
}
