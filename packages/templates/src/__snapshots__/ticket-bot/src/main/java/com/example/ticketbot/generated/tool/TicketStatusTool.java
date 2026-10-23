// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.ticketbot.generated.tool;

import java.util.Objects;
import java.util.Optional;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code GET https://tickets.example.org/api/tickets/{ticketId}} for the model. */
@Component
public class TicketStatusTool {

    private final RestClient restClient;

    private final int maxResponseChars;

    TicketStatusTool(RestClient.Builder restClientBuilder, TicketStatusToolProperties properties) {
        this.restClient = restClientBuilder
            .baseUrl(properties.url())
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.token())
            .build();
        this.maxResponseChars = properties.maxResponseChars();
    }

    @Tool(description = "Status of a ticket, with its history when asked")
    public String ticketStatus(String ticketId, @ToolParam(required = false) Boolean withHistory) {
        Objects.requireNonNull(ticketId, "ticketId is required");
        String body = restClient
            .get()
            .uri(uri -> uri.queryParamIfPresent("withHistory", Optional.ofNullable(withHistory)).build(ticketId))
            .retrieve()
            .body(String.class);
        return ToolResponses.limit(body, maxResponseChars);
    }
}
