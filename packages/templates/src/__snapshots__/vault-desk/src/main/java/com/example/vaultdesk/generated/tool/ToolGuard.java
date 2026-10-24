// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.tool;

import com.example.vaultdesk.generated.privacy.PersonalData;
import java.util.Arrays;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Component;

/**
 * Every tool of the model, generated or from an MCP server, goes through here. An answer built from a tool depends
 * on live data: the cache does not keep it. Tools get the real personal data behind the tokens the model
 * saw, and their results reach the model masked. Tools run on the thread of the request, whose state is kept here.
 */
@Component
public class ToolGuard {

    private final ThreadLocal<String> conversation = new ThreadLocal<>();

    private final ThreadLocal<Boolean> called = ThreadLocal.withInitial(() -> false);

    private final PersonalData personalData;

    ToolGuard(PersonalData personalData) {
        this.personalData = personalData;
    }

    /** Before asking the model, with the conversation whose tokens the tools may see. */
    public void start(String conversationKey) {
        conversation.set(conversationKey);
        called.set(false);
    }

    public boolean toolCalled() {
        return called.get();
    }

    public ToolCallback[] guard(ToolCallback[] callbacks) {
        return Arrays.stream(callbacks)
            .map(callback -> new GuardedToolCallback(callback, this))
            .toArray(ToolCallback[]::new);
    }

    String beforeCall(String input) {
        called.set(true);
        return personalData.restore(conversation.get(), input);
    }

    String afterCall(String result) {
        return personalData.mask(conversation.get(), result);
    }
}
