// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.ticketbot.generated.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code GET https://status.example.org/api/status} for the model. */
@Component
public class ServiceStatusTool {

    private final RestClient restClient;

    ServiceStatusTool(RestClient.Builder restClientBuilder, ServiceStatusToolProperties properties) {
        this.restClient = restClientBuilder.baseUrl(properties.url()).build();
    }

    @Tool(description = "Current status of the service")
    public String serviceStatus() {
        return restClient.get().retrieve().body(String.class);
    }
}
