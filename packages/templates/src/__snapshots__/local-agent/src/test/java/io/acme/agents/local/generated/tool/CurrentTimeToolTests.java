// Managed by gen-agent: changes here are overwritten.
package io.acme.agents.local.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CurrentTimeToolTests {

    @Test
    void delegatesToTheHandler() {
        CurrentTimeTool tool = new CurrentTimeTool(() -> "handled");

        assertThat(tool.currentTime()).isEqualTo("handled");
    }
}
