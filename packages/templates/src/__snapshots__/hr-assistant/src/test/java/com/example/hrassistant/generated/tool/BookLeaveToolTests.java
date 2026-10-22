// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BookLeaveToolTests {

    @Test
    void delegatesToTheHandler() {
        BookLeaveTool tool = new BookLeaveTool((date, halfDay) -> "handled");

        assertThat(tool.bookLeave("test", null)).isEqualTo("handled");
    }
}
