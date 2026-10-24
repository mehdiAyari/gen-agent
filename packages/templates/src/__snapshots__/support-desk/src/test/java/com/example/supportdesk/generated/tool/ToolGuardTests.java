// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;

class ToolGuardTests {

    private final ToolGuard guard = new ToolGuard();

    private volatile String clockResult = "noon";

    private final List<String> changes = new CopyOnWriteArrayList<>();

    private final ToolCallback clock = tool("orderStatus", input -> clockResult);

    private final ToolCallback refund = tool("refund", input -> {
        changes.add(input);
        return "refunded";
    });

    private static ToolCallback tool(String name, UnaryOperator<String> call) {
        return new ToolCallback() {
            @Override
            public ToolDefinition getToolDefinition() {
                return ToolDefinition.builder().name(name).description(name).inputSchema("{}").build();
            }

            @Override
            public String call(String toolInput) {
                return call.apply(toolInput);
            }
        };
    }

    private ToolCallback guarded(ToolCallback callback) {
        return guard.guard(new ToolCallback[] { callback })[0];
    }

    @Test
    void tellsWhenTheModelCalledATool() {
        ToolCallback guarded = guarded(clock);
        guard.start();

        assertThat(guard.toolCalled()).isFalse();
        assertThat(guarded.call("{}")).contains("noon");
        assertThat(guard.toolCalled()).isTrue();
    }

    @Test
    void forgetsTheCallsOfThePreviousRequest() {
        guarded(clock).call("{}");
        guard.start();

        assertThat(guard.toolCalled()).isFalse();
    }
}
