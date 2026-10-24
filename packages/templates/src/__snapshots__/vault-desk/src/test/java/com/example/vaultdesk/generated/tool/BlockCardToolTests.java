// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BlockCardToolTests {

    @Test
    void delegatesToTheHandler() {
        BlockCardTool tool = new BlockCardTool(() -> "handled");

        assertThat(tool.blockCard()).isEqualTo("handled");
    }
}
