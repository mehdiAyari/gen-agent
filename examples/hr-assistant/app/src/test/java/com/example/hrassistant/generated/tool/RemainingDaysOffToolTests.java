// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RemainingDaysOffToolTests {

    @Test
    void delegatesToTheHandler() {
        RemainingDaysOffTool tool = new RemainingDaysOffTool(() -> "handled");

        assertThat(tool.remainingDaysOff()).isEqualTo("handled");
    }
}
