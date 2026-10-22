package io.acme.agents.local.tool;

import io.acme.agents.local.generated.tool.CurrentTimeHandler;
import org.springframework.stereotype.Component;

@Component
class DefaultCurrentTimeHandler implements CurrentTimeHandler {

    @Override
    public String currentTime() {
        // Implement current-time here: the text you return is what the model reads.
        throw new UnsupportedOperationException("current-time is not implemented yet");
    }
}
