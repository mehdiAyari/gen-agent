// Managed by gen-agent: changes here are overwritten. Implement the tool in DefaultRemainingDaysOffHandler.
package com.example.hrassistant.generated.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/** Exposes {@code remaining-days-off} to the model and delegates the work to {@link RemainingDaysOffHandler}. */
@Component
public class RemainingDaysOffTool {

    private final RemainingDaysOffHandler handler;

    RemainingDaysOffTool(RemainingDaysOffHandler handler) {
        this.handler = handler;
    }

    @Tool(description = "Days off the signed-in employee has left this year")
    public String remainingDaysOff() {
        return handler.remainingDaysOff();
    }
}
