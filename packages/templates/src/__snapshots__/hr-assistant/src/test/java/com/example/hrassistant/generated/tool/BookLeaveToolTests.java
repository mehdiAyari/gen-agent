// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.Test;

class BookLeaveToolTests {

    @Test
    void delegatesToTheHandler() {
        BookLeaveTool tool = new BookLeaveTool((date, halfDay) -> "handled");

        assertThat(tool.bookLeave("test", null)).isEqualTo("handled");
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        BookLeaveTool tool = new BookLeaveTool((date, halfDay) -> "handled");

        assertThatNullPointerException()
            .isThrownBy(() -> tool.bookLeave(null, null))
            .withMessage("date is required");
    }
}
