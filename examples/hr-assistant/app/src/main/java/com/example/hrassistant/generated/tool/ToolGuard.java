// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.tool;

import com.example.hrassistant.generated.approval.Approvals;
import com.example.hrassistant.generated.approval.PendingApproval;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.UnaryOperator;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Component;

/**
 * Every tool of the model, generated or from an MCP server, goes through here. An answer built from a tool depends
 * on live data: the cache does not keep it. Sensitive calls
 * wait for the approval of the user who asked.
 * Tools run on the thread of the request, whose state is kept here.
 */
@Component
public class ToolGuard {

    /** Tools whose calls wait for the approval of the user, and for how long. */
    private static final Map<String, Duration> APPROVAL = Map.of("bookDayOff", Duration.ofHours(24));

    private final Map<String, ToolCallback> tools = new ConcurrentHashMap<>();

    private final ThreadLocal<String> conversation = new ThreadLocal<>();

    private final ThreadLocal<String> user = new ThreadLocal<>();

    private final ThreadLocal<String> conversationId = new ThreadLocal<>();

    private final ThreadLocal<List<PendingApproval>> pending = ThreadLocal.withInitial(ArrayList::new);

    private final ThreadLocal<Boolean> approved = ThreadLocal.withInitial(() -> false);

    private final ThreadLocal<Boolean> called = ThreadLocal.withInitial(() -> false);

    private final Approvals approvals;

    ToolGuard(Approvals approvals) {
        this.approvals = approvals;
    }

    /** Before asking the model, with the conversation calls may wait in. */
    public void start(String conversationKey, String userId, String conversationId) {
        conversation.set(conversationKey);
        user.set(userId);
        this.conversationId.set(conversationId);
        pending.set(new ArrayList<>());
        called.set(false);
    }

    public boolean toolCalled() {
        return called.get();
    }

    /** The calls of this request that wait for the approval of the user. */
    public List<PendingApproval> pendingApprovals() {
        return List.copyOf(pending.get());
    }

    /** Makes a call the user approved, through the other guards. */
    public String callApproved(String tool, String input) {
        ToolCallback callback = tools.get(tool);
        if (callback == null) {
            return "The tool " + tool + " no longer exists: the call was not made.";
        }
        approved.set(true);
        try {
            return call(tool, input, callback::call);
        } catch (RuntimeException failure) {
            return "The call failed: " + failure.getMessage();
        } finally {
            approved.set(false);
        }
    }

    public ToolCallback[] guard(ToolCallback[] callbacks) {
        for (ToolCallback callback : callbacks) {
            tools.put(callback.getToolDefinition().name(), callback);
        }
        return Arrays.stream(callbacks)
            .map(callback -> new GuardedToolCallback(callback, this))
            .toArray(ToolCallback[]::new);
    }

    String call(String tool, String input, UnaryOperator<String> delegate) {
        called.set(true);
        Duration expiresAfter = APPROVAL.get(tool);
        if (expiresAfter != null && !approved.get()) {
            PendingApproval approval = approvals.request(
                user.get(),
                conversation.get(),
                conversationId.get(),
                tool,
                input,
                expiresAfter
            );
            pending.get().add(approval);
            return (
                "This call waits for the approval of the user until " +
                approval.expiresAt() +
                ": tell them it is not done yet."
            );
        }
        String result = delegate.apply(input);
        return result;
    }
}
