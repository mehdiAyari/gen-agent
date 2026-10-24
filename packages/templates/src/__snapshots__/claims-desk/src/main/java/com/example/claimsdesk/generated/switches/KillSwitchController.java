// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated.switches;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** For the agent-admin role: which parts of the agent are on, and switching them off or on again. */
@RestController
@RequestMapping("/api/admin/switches")
class KillSwitchController {

    /**
     * @param agent whether the agent answers
     * @param tools whether each tool may be called, by its name for the model
     */
    record Switches(boolean agent, Map<String, Boolean> tools) {}

    record Switch(@NotNull Boolean on) {}

    private final KillSwitches killSwitches;

    private final Set<String> tools;

    KillSwitchController(KillSwitches killSwitches) {
        this.killSwitches = killSwitches;
        this.tools = Set.of();
    }

    @GetMapping
    Switches switches() {
        Map<String, Boolean> state = new TreeMap<>();
        for (String tool : tools) {
            state.put(tool, !killSwitches.toolOff(tool));
        }
        return new Switches(!killSwitches.agentOff(), state);
    }

    @PutMapping("/agent")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void switchAgent(@Valid @RequestBody Switch request) {
        killSwitches.switchAgent(request.on());
    }

    @PutMapping("/tools/{tool}")
    ResponseEntity<Void> switchTool(@PathVariable String tool, @Valid @RequestBody Switch request) {
        if (!tools.contains(tool)) {
            return ResponseEntity.notFound().build();
        }
        killSwitches.switchTool(tool, request.on());
        return ResponseEntity.noContent().build();
    }
}
