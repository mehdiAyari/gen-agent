// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.vaultdesk.generated.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.web.client.RestClient;

/** Health and metrics answer on the management port, without a token: they never leave the private network. */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.ai.mistralai.api-key=test-key",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.org",
        "agent.rag.documents=src/test/resources/documents",
        "agent.timeout=3s",
        "agent.tools.transfer-status.token=test-token",
        "management.server.port=0",
    }
)
@Import({ VaultDeskApplicationTests.FakeModelConfiguration.class, TestcontainersConfiguration.class })
class ObservabilityTests {

    @Value("${local.management.port}")
    int managementPort;

    @Autowired
    ChatClient chatClient;

    @Test
    void answersHealthChecks() {
        assertThat(get("/actuator/health")).contains("UP");
    }

    @Test
    void exposesTheMetricsOfTheChatClientToPrometheus() {
        chatClient
            .prompt()
            .user("Hello")
            .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, "observability"))
            .call()
            .content();

        assertThat(get("/actuator/prometheus")).contains("spring_ai_chat_client");
    }

    @Test
    void exposesTheCountersOfTheAgentAtZeroFromTheStart() {
        // Prometheus counts the first increase of a counter only when the counter was there before it.
        assertThat(get("/actuator/prometheus")).contains(
            "agent_guard_refusals_total{",
            "reason=\"injection\"",
            "reason=\"leak\"",
            "agent_feedback_total{",
            "rating=\"up\"",
            "rating=\"down\""
        );
    }

    private String get(String path) {
        return RestClient.create("http://localhost:" + managementPort)
            .get()
            .uri(path)
            .retrieve()
            .body(String.class);
    }
}
