// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.vaultdesk.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code GET https://bank.example.org/api/transfers} for the model. */
@Component
public class TransferStatusTool {

    private final RestClient restClient;

    private final int maxResponseChars;

    TransferStatusTool(RestClient.Builder restClientBuilder, TransferStatusToolProperties properties) {
        this.restClient = restClientBuilder
            .baseUrl(properties.url())
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.token())
            .build();
        this.maxResponseChars = properties.maxResponseChars();
    }

    @Tool(description = "Status of the last transfer to an IBAN")
    public String transferStatus(String iban) {
        Objects.requireNonNull(iban, "iban is required");
        String body = restClient
            .get()
            .uri(uri -> uri.queryParam("iban", iban).build())
            .retrieve()
            .body(String.class);
        return ToolResponses.limit(body, maxResponseChars);
    }
}
