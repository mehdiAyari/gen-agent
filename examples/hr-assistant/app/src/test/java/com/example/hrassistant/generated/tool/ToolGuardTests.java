// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.hrassistant.generated.approval.Approvals;
import com.example.hrassistant.generated.approval.PendingApproval;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;

class ToolGuardTests {

    private final Approvals approvals = mock(Approvals.class);

    private final ToolGuard guard = new ToolGuard(approvals);

    @BeforeEach
    void startARequest() {
        guard.start("conversation", "ada", "c1");
    }

    private volatile String clockResult = "noon";

    private final List<String> changes = new CopyOnWriteArrayList<>();

    private final ToolCallback clock = tool("clock", input -> clockResult);

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
    void keepsACallThatNeedsApprovalUntilTheUserApprovesIt() {
        ToolCallback sensitive = tool("bookDayOff", input -> {
            changes.add(input);
            return "done";
        });
        PendingApproval pending = new PendingApproval(UUID.randomUUID(), "bookDayOff", "{}", Instant.now());
        when(approvals.request(eq("ada"), eq("conversation"), eq("c1"), eq("bookDayOff"), eq("{}"), any())).thenReturn(
            pending
        );

        assertThat(guarded(sensitive).call("{}")).contains("waits for the approval of the user");
        assertThat(changes).isEmpty();
        assertThat(guard.pendingApprovals()).containsExactly(pending);

        assertThat(guard.callApproved("bookDayOff", "{}")).contains("done");
        assertThat(changes).containsExactly("{}");
    }

    @Test
    void tellsWhenTheModelCalledATool() {
        ToolCallback guarded = guarded(clock);
        guard.start("conversation", "ada", "c1");

        assertThat(guard.toolCalled()).isFalse();
        assertThat(guarded.call("{}")).contains("noon");
        assertThat(guard.toolCalled()).isTrue();
    }

    @Test
    void forgetsTheCallsOfThePreviousRequest() {
        guarded(clock).call("{}");
        guard.start("conversation", "ada", "c1");

        assertThat(guard.toolCalled()).isFalse();
    }
}
