package com.example.docshelper;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.docshelper.generated.TestcontainersConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

/**
 * Starts the whole application with a fake model: checks the wiring (system prompt, memory, tools) and the REST
 * endpoint without calling a real provider.
 */
@SpringBootTest(properties = "agent.rag.documents=src/test/resources/documents")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class DocsHelperApplicationTests {

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
    void sendsTheSystemPromptAndRemembersTheConversation() {
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

        assertThat(chatModel.lastPrompt().getContents()).contains("You are", "My name is Ada", "What is my name?");
    }

    @Test
    void tellsClientsTheReplyComesFromAnAi() {
        assertThat(
            post(
                """
                {"message": "Hello"}
                """
            )
        )
            .bodyJson()
            .extractingPath("$.aiGenerated")
            .isEqualTo(true);
    }

    private MvcTestResult post(String body) {
        return mockMvc.post().uri("/api/chat").contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    @Test
    void answersFromTheDocumentsOfTheKnowledgeBase() {
        ask("When is the agency open on Monday?");

        assertThat(chatModel.lastPrompt().getContents())
            .contains("<document source=\"opening-hours.md\">")
            .contains("9am to 5pm");
    }

    private MvcTestResult ask(String message) {
        return post("{\"message\": \"" + message + "\"}");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FakeModelConfiguration {

        @Bean
        @Primary
        RecordingChatModel chatModel() {
            return new RecordingChatModel();
        }

        @Bean
        @Primary
        WordsEmbeddingModel embeddingModel() {
            return new WordsEmbeddingModel();
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

    /** Embeds a text by its words: texts with the same words get the same vector, without calling a provider. */
    static class WordsEmbeddingModel implements EmbeddingModel {

        private static final int DIMENSIONS = 768;

        @Override
        public EmbeddingResponse call(EmbeddingRequest request) {
            List<Embedding> embeddings = new ArrayList<>();
            for (String text : request.getInstructions()) {
                embeddings.add(new Embedding(vectorOf(text), embeddings.size()));
            }
            return new EmbeddingResponse(embeddings);
        }

        @Override
        public float[] embed(Document document) {
            return vectorOf(document.getText());
        }

        @Override
        public int dimensions() {
            return DIMENSIONS;
        }

        private static float[] vectorOf(String text) {
            float[] vector = new float[DIMENSIONS];
            for (String word : text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
                if (!word.isEmpty()) {
                    vector[Math.floorMod(word.hashCode(), DIMENSIONS)] += 1;
                }
            }
            return vector;
        }
    }
}
