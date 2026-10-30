// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.petstoreassistant.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code GET https://petstore3.swagger.io/api/v3/pet/findByStatus} for the model. */
@Component
public class FindPetsByStatusTool {

    private final RestClient restClient;

    private final int maxResponseChars;

    FindPetsByStatusTool(RestClient.Builder restClientBuilder, FindPetsByStatusToolProperties properties) {
        this.restClient = restClientBuilder.baseUrl(properties.url()).build();
        this.maxResponseChars = properties.maxResponseChars();
    }

    @Tool(description = "Finds Pets by status.")
    public String findPetsByStatus(
        @ToolParam(
            description = "Status values that need to be considered for filter. One of: available, pending, sold."
        ) String status
    ) {
        Objects.requireNonNull(status, "status is required");
        String body = restClient
            .get()
            .uri(uri -> uri.queryParam("status", status).build())
            .retrieve()
            .body(String.class);
        return ToolResponses.limit(body, maxResponseChars);
    }
}
