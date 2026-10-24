// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.switches;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Switches the agent or one of its tools off, at once and for every instance: flags in Redis, read on each request
 * and each tool call.
 */
@Component
public class KillSwitches {

    private static final String AGENT = "switch:agent";

    private static final String TOOL = "switch:tool:";

    private final StringRedisTemplate redis;

    KillSwitches(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public boolean agentOff() {
        return redis.hasKey(AGENT);
    }

    public boolean toolOff(String tool) {
        return redis.hasKey(TOOL + tool);
    }

    public void switchAgent(boolean on) {
        set(AGENT, on);
    }

    public void switchTool(String tool, boolean on) {
        set(TOOL + tool, on);
    }

    private void set(String key, boolean on) {
        if (on) {
            redis.delete(key);
        } else {
            redis.opsForValue().set(key, "off");
        }
    }
}
