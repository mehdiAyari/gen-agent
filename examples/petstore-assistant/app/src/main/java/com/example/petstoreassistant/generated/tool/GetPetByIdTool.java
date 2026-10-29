// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.petstoreassistant.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code GET https://petstore3.swagger.io/api/v3/pet/{petId}} for the model. */
@Component
public class GetPetByIdTool {

    private final RestClient restClient;

    private final int maxResponseChars;

    GetPetByIdTool(RestClient.Builder restClientBuilder, GetPetByIdToolProperties properties) {
        this.restClient = restClientBuilder
            .baseUrl(properties.url())
            .defaultHeader("api_key", properties.token())
            .build();
        this.maxResponseChars = properties.maxResponseChars();
    }

    @Tool(description = "Find pet by ID.")
    public String getPetById(@ToolParam(description = "ID of pet to return") Long petId) {
        Objects.requireNonNull(petId, "petId is required");
        String body = restClient
            .get()
            .uri(uri -> uri.build(petId))
            .retrieve()
            .body(String.class);
        return ToolResponses.limit(body, maxResponseChars);
    }
}
