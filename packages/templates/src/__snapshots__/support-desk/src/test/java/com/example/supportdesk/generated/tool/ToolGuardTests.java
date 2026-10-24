// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;

class ToolGuardTests {

    private final ToolGuard guard = new ToolGuard();

    private final ToolCallback clock = new ToolCallback() {
        @Override
        public ToolDefinition getToolDefinition() {
            return ToolDefinition.builder().name("clock").description("Current time").inputSchema("{}").build();
        }

        @Override
        public String call(String toolInput) {
            return "noon";
        }
    };

    @Test
    void tellsWhenTheModelCalledATool() {
        ToolCallback guarded = guard.guard(new ToolCallback[] { clock })[0];
        guard.start();

        assertThat(guard.toolCalled()).isFalse();
        assertThat(guarded.call("{}")).isEqualTo("noon");
        assertThat(guard.toolCalled()).isTrue();
    }

    @Test
    void forgetsTheCallsOfThePreviousRequest() {
        guard.guard(new ToolCallback[] { clock })[0].call("{}");
        guard.start();

        assertThat(guard.toolCalled()).isFalse();
    }
}
