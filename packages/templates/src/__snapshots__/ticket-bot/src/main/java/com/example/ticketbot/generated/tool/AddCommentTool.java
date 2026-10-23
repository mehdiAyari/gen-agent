// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.ticketbot.generated.tool;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code POST https://tickets.example.org/api/projects/{project}/tickets/{ticketId}/comments} for the model. */
@Component
public class AddCommentTool {

    private final RestClient restClient;

    private final int maxResponseChars;

    AddCommentTool(RestClient.Builder restClientBuilder, AddCommentToolProperties properties) {
        this.restClient = restClientBuilder
            .baseUrl(properties.url())
            .defaultHeader("X-API-Key", properties.token())
            .build();
        this.maxResponseChars = properties.maxResponseChars();
    }

    record Request(String text, @JsonProperty("author_email") String authorEmail) {}

    @Tool(description = "Adds a comment to a ticket")
    public String addComment(Long ticketId, String project, String text, String authorEmail) {
        Objects.requireNonNull(ticketId, "ticketId is required");
        Objects.requireNonNull(project, "project is required");
        Objects.requireNonNull(text, "text is required");
        Objects.requireNonNull(authorEmail, "authorEmail is required");
        String body = restClient
            .post()
            .uri(uri -> uri.build(project, ticketId))
            .contentType(MediaType.APPLICATION_JSON)
            .body(new Request(text, authorEmail))
            .retrieve()
            .body(String.class);
        return ToolResponses.limit(body, maxResponseChars);
    }
}
