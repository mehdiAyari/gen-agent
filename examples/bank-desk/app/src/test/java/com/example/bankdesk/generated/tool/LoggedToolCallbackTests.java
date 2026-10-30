// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

@ExtendWith(OutputCaptureExtension.class)
class LoggedToolCallbackTests {

    @Test
    void logsTheToolAndItsDurationNeverItsArgumentsNorItsResult(CapturedOutput output) {
        ToolCallback tool = LoggedToolCallback.logged(new ToolCallback[] {
            tool("transfer", input -> "sent to " + input),
        })[0];

        assertThat(tool.call("FR7630006000011234567890189")).isEqualTo("sent to FR7630006000011234567890189");
        assertThat(output).contains("Tool transfer answered in").doesNotContain("FR7630006000011234567890189");
    }

    @Test
    void logsAFailureAndLetsItThrough(CapturedOutput output) {
        ToolCallback tool = LoggedToolCallback.logged(new ToolCallback[] {
            tool("transfer", input -> {
                throw new IllegalStateException("bank down for FR7630006000011234567890189");
            }),
        })[0];

        assertThatThrownBy(() -> tool.call("{}")).isInstanceOf(IllegalStateException.class);
        assertThat(output)
            .contains("Tool transfer failed after", "IllegalStateException")
            .doesNotContain("FR7630006000011234567890189");
    }

    private static ToolCallback tool(String name, UnaryOperator<String> behaviour) {
        return new ToolCallback() {
            @Override
            public ToolDefinition getToolDefinition() {
                return ToolDefinition.builder().name(name).description(name).inputSchema("{}").build();
            }

            @Override
            public String call(String toolInput) {
                return behaviour.apply(toolInput);
            }
        };
    }
}
