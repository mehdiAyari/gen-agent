// Managed by gen-agent: changes here are overwritten.
package com.example.ticketbot.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ToolResponsesTests {

    @Test
    void keepsAShortBodyAsItIs() {
        assertThat(ToolResponses.limit("{\"ok\":true}", 100)).isEqualTo("{\"ok\":true}");
    }

    @Test
    void cutsALongBodyAndSaysHowMuchIsMissing() {
        assertThat(ToolResponses.limit("abcdefghij", 4)).isEqualTo("abcd\n[Truncated: 6 more characters.]");
    }

    @Test
    void tellsTheModelWhenTheBodyIsEmpty() {
        assertThat(ToolResponses.limit(null, 100)).isEqualTo("The API returned an empty response.");
        assertThat(ToolResponses.limit("", 100)).isEqualTo("The API returned an empty response.");
    }
}
