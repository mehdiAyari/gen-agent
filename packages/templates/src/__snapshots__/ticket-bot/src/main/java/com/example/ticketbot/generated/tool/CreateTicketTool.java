// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.ticketbot.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code POST https://tickets.example.org/api/tickets} for the model. */
@Component
public class CreateTicketTool {

    private final RestClient restClient;

    private final int maxResponseChars;

    CreateTicketTool(RestClient.Builder restClientBuilder, CreateTicketToolProperties properties) {
        this.restClient = restClientBuilder
            .baseUrl(properties.url())
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.token())
            .build();
        this.maxResponseChars = properties.maxResponseChars();
    }

    record Request(String title, Long priority) {}

    @Tool(description = "Creates a support ticket")
    public String createTicket(String title, @ToolParam(required = false) Long priority) {
        Objects.requireNonNull(title, "title is required");
        String body = restClient
            .post()
            .contentType(MediaType.APPLICATION_JSON)
            .body(new Request(title, priority))
            .retrieve()
            .body(String.class);
        return ToolResponses.limit(body, maxResponseChars);
    }
}
