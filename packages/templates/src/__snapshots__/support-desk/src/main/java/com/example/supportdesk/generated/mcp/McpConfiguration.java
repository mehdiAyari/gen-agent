// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.mcp;

import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
import java.net.http.HttpRequest;
import java.util.Map;
import org.springframework.ai.mcp.customizer.McpClientCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Signs the requests to the remote MCP servers with their token, read from the environment. */
@Configuration(proxyBeanMethods = false)
class McpConfiguration {

    @Bean
    McpClientCustomizer<HttpClientStreamableHttpTransport.Builder> mcpTokens(
        @Value("${agent.mcp.knowledge.token}") String knowledgeToken
    ) {
        // Each request is a copy of this one, with the header of its server.
        Map<String, HttpRequest.Builder> requests = Map.of(
            "knowledge",
            HttpRequest.newBuilder().header("Authorization", "Bearer " + knowledgeToken)
        );
        return (name, transport) -> {
            HttpRequest.Builder request = requests.get(name);
            if (request != null) {
                transport.requestBuilder(request);
            }
        };
    }
}
