// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.supportdesk.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code GET https://shop.example.org/api/orders/{orderId}} for the model. */
@Component
public class OrderStatusTool {

    private final RestClient restClient;

    private final int maxResponseChars;

    OrderStatusTool(RestClient.Builder restClientBuilder, OrderStatusToolProperties properties) {
        this.restClient = restClientBuilder
            .baseUrl(properties.url())
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.token())
            .build();
        this.maxResponseChars = properties.maxResponseChars();
    }

    @Tool(description = "Status and delivery date of a customer order")
    public String orderStatus(String orderId) {
        Objects.requireNonNull(orderId, "orderId is required");
        String body = restClient
            .get()
            .uri(uri -> uri.build(orderId))
            .retrieve()
            .body(String.class);
        return ToolResponses.limit(body, maxResponseChars);
    }
}
