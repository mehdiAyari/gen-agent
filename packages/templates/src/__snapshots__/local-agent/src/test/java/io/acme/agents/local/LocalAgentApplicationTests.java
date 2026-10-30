package io.acme.agents.local;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

/**
 * Starts the whole application with a fake model: checks the wiring (system prompt, memory, tools) and the REST
 * endpoint without calling a real provider.
 */
@SpringBootTest
@AutoConfigureMockMvc
class LocalAgentApplicationTests {

    @Autowired
    MockMvcTester mockMvc;

    @Autowired
    RecordingChatModel chatModel;

    @Test
    void answersOnTheChatEndpoint() {
        assertThat(
            post(
                """
                {"message": "Hello"}
                """
            )
        )
            .hasStatusOk()
            .bodyJson()
            .extractingPath("$.reply")
            .isEqualTo("Hello from the agent");
    }

    @Test
    void sendsTheSystemPromptAndRemembersTheConversation() throws Exception {
        post(
            """
            {"conversationId": "c1", "message": "My name is Ada"}
            """
        );
        post(
            """
            {"conversationId": "c1", "message": "What is my name?"}
            """
        );

        assertThat(chatModel.lastPrompt().getContents()).contains(systemPrompt(), "My name is Ada", "What is my name?");
    }

    private MvcTestResult post(String body) {
        return mockMvc.post().uri("/api/chat").contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    /** The system prompt as written in its file, whatever it says. */
    private static String systemPrompt() throws IOException {
        return new ClassPathResource("prompts/local-agent.md").getContentAsString(StandardCharsets.UTF_8).strip();
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FakeModelConfiguration {

        @Bean
        @Primary
        RecordingChatModel chatModel() {
            return new RecordingChatModel();
        }
    }

    /** Answers every prompt with the same text and keeps the last prompt for assertions. */
    static class RecordingChatModel implements ChatModel {

        private volatile Prompt lastPrompt;

        @Override
        public ChatResponse call(Prompt prompt) {
            this.lastPrompt = prompt;
            String text = "Hello from the agent";
            return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
        }

        Prompt lastPrompt() {
            return lastPrompt;
        }
    }
}
