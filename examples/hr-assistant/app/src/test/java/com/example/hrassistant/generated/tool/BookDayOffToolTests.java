// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.Test;

class BookDayOffToolTests {

    @Test
    void delegatesToTheHandler() {
        BookDayOffTool tool = new BookDayOffTool(date -> "handled");

        assertThat(tool.bookDayOff("test")).isEqualTo("handled");
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        BookDayOffTool tool = new BookDayOffTool(date -> "handled");

        assertThatNullPointerException()
            .isThrownBy(() -> tool.bookDayOff(null))
            .withMessage("date is required");
    }
}
