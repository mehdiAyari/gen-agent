// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.bankdesk.generated.TestcontainersConfiguration;
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
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.org",
        "agent.timeout=3s",
        "management.server.port=0",
    }
)
@Import({ BankDeskApplicationTests.FakeModelConfiguration.class, TestcontainersConfiguration.class })
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

    private String get(String path) {
        return RestClient.create("http://localhost:" + managementPort)
            .get()
            .uri(path)
            .retrieve()
            .body(String.class);
    }
}
