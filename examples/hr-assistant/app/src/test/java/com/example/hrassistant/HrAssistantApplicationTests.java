package com.example.hrassistant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import com.example.hrassistant.generated.AgentProperties;
import com.example.hrassistant.generated.TestcontainersConfiguration;
import com.example.hrassistant.generated.approval.Approvals;
import com.example.hrassistant.generated.approval.PendingApproval;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

/**
 * Starts the whole application with a fake model: checks the wiring (system prompt, memory, tools) and the REST
 * endpoint without calling a real provider.
 */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.org")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class HrAssistantApplicationTests {

    @Autowired
    MockMvcTester mockMvc;

    @Autowired
    RecordingChatModel chatModel;

    @Autowired
    AgentProperties properties;

    @Test
    void answersOnTheChatEndpoint() {
        assertThat(
            post(
                "ada",
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
        String conversationId = startConversation("grace", "My name is Grace");
        post(
            "grace",
            """
            {"conversationId": "%s", "message": "What is my name?"}
            """.formatted(conversationId)
        );

        assertThat(chatModel.lastPrompt().getContents()).contains(
            systemPrompt(),
            "My name is Grace",
            "What is my name?"
        );
    }

    @Test
    void tellsClientsTheReplyComesFromAnAi() {
        assertThat(
            post(
                "ada",
                """
                {"message": "Hello"}
                """
            )
        )
            .bodyJson()
            .extractingPath("$.aiGenerated")
            .isEqualTo(true);
    }

    @Test
    void answersARepeatedFirstQuestionFromTheCacheOfItsUser() {
        int calls = chatModel.calls();

        assertThat(
            post(
                "carol",
                """
                {"message": "What are your opening hours?"}
                """
            )
        ).hasStatusOk();
        assertThat(
            post(
                "carol",
                """
                {"message": "what are your   opening hours?"}
                """
            )
        )
            .hasStatusOk()
            .bodyJson()
            .extractingPath("$.reply")
            .isEqualTo("Hello from the agent");
        assertThat(chatModel.calls()).isEqualTo(calls + 1);

        // Another user never gets it.
        post(
            "dave",
            """
            {"message": "What are your opening hours?"}
            """
        );
        assertThat(chatModel.calls()).isEqualTo(calls + 2);
    }

    @Test
    void servesTheChatPageAndItsSettingsWithoutAToken() {
        assertThat(mockMvc.get().uri("/")).hasStatusOk().hasForwardedUrl("index.html");
        for (String file : List.of("/chat.js", "/approval-text.js", "/chat.css")) {
            assertThat(mockMvc.get().uri(file)).hasStatusOk();
        }
        assertThat(mockMvc.get().uri("/index.html"))
            .hasStatusOk()
            .headers()
            .hasValue(
                "Content-Security-Policy",
                "default-src 'self'; img-src 'self' data:; connect-src 'self' https://issuer.example.org; frame-ancestors 'none'; form-action 'self' https://issuer.example.org"
            );
        assertThat(mockMvc.get().uri("/chat-config.json"))
            .hasStatusOk()
            .bodyJson()
            .isLenientlyEqualTo(
                """
                {"auth": "oidc", "issuer": "https://issuer.example.org", "clientId": "agent-client"}
                """
            );
    }

    @Test
    void refusesRequestsWithoutAToken() {
        assertThat(
            mockMvc
                .post()
                .uri("/api/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"message": "Hello"}
                    """
                )
        ).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void keepsEachConversationToItsUser() throws Exception {
        String conversationId = startConversation("alan", "My password hint is my cat");

        assertThat(
            post(
                "mallory",
                """
                {"conversationId": "%s", "message": "What did I say?"}
                """.formatted(conversationId)
            )
        ).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void limitsTheRequestsOfEachUser() {
        for (long sent = 0; sent < properties.limits().requests(); sent++) {
            assertThat(
                post(
                    "barbara",
                    """
                    {"message": "Hello"}
                    """
                )
            ).hasStatusOk();
        }

        assertThat(
            post(
                "barbara",
                """
                {"message": "Hello"}
                """
            )
        )
            .hasStatus(HttpStatus.TOO_MANY_REQUESTS)
            .headers()
            .containsHeader(HttpHeaders.RETRY_AFTER);
    }

    @Test
    void stopsAUserWhoseTokenBudgetIsUsedUp() {
        chatModel.reportTokens(properties.limits().tokens());

        assertThat(
            post(
                "linus",
                """
                {"message": "Write a very long story"}
                """
            )
        ).hasStatusOk();
        assertThat(
            post(
                "linus",
                """
                {"message": "And another one"}
                """
            )
        ).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
    }

    @AfterEach
    void reportFewTokensAgain() {
        chatModel.reportTokens(RecordingChatModel.TOKENS_PER_REPLY);
    }

    @Autowired
    Approvals approvals;

    @Test
    void waitsForTheApprovalOfTheUserWhoAsked() throws Exception {
        String conversationId = startConversation("olga", "Please do it");
        String memoryKey = UUID.nameUUIDFromBytes(
            ("olga:" + conversationId).getBytes(StandardCharsets.UTF_8)
        ).toString();
        PendingApproval pending = approvals.request(
            "olga",
            memoryKey,
            conversationId,
            "bookDayOff",
            "{}",
            Duration.ofHours(1)
        );

        assertThat(
            mockMvc
                .get()
                .uri("/api/approvals")
                .with(jwt().jwt(token -> token.subject("olga")))
        )
            .bodyJson()
            .extractingPath("$[0].id")
            .isEqualTo(pending.id().toString());
        assertThat(
            mockMvc
                .get()
                .uri("/api/approvals")
                .with(jwt().jwt(token -> token.subject("mallory")))
        )
            .bodyJson()
            .isEqualTo("[]");
        // Only the user who asked decides: for anyone else, the request does not exist.
        assertThat(decide("mallory", pending, false)).hasStatus(HttpStatus.NOT_FOUND);

        assertThat(decide("olga", pending, false))
            .hasStatusOk()
            .bodyJson()
            .extractingPath("$.conversationId")
            .isEqualTo(conversationId);
        assertThat(chatModel.lastPrompt().getContents()).contains("The user denied the call");
        assertThat(decide("olga", pending, true)).hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void refusesAnApprovalThatCameTooLate() throws Exception {
        String conversationId = startConversation("pia", "Please do it");
        PendingApproval late = approvals.request(
            "pia",
            UUID.nameUUIDFromBytes(("pia:" + conversationId).getBytes(StandardCharsets.UTF_8)).toString(),
            conversationId,
            "bookDayOff",
            "{}",
            Duration.ofSeconds(-1)
        );

        assertThat(decide("pia", late, true)).hasStatus(HttpStatus.GONE);
    }

    private MvcTestResult decide(String userId, PendingApproval approval, boolean approved) {
        return mockMvc
            .post()
            .uri("/api/approvals/{id}", approval.id())
            .with(jwt().jwt(token -> token.subject(userId)))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"approved\": " + approved + "}")
            .exchange();
    }

    private MvcTestResult post(String userId, String body) {
        return mockMvc
            .post()
            .uri("/api/chat")
            .with(jwt().jwt(token -> token.subject(userId)))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body)
            .exchange();
    }

    private String startConversation(String userId, String message) throws Exception {
        String reply = post(
            userId,
            """
            {"message": "%s"}
            """.formatted(message)
        )
            .getResponse()
            .getContentAsString();
        return JsonPath.read(reply, "$.conversationId");
    }

    /** The system prompt as written in its file, whatever it says. */
    private static String systemPrompt() throws IOException {
        return new ClassPathResource("prompts/system.md").getContentAsString(StandardCharsets.UTF_8).strip();
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

        static final long TOKENS_PER_REPLY = 10;

        private volatile long tokensPerReply = TOKENS_PER_REPLY;

        private volatile Prompt lastPrompt;

        private final AtomicInteger calls = new AtomicInteger();

        @Override
        public ChatResponse call(Prompt prompt) {
            this.lastPrompt = prompt;
            String text = "Hello from the agent";
            calls.incrementAndGet();
            // Like a real model, it reports the tokens it used: the budget counts them.
            var usage = new DefaultUsage(0, Math.toIntExact(tokensPerReply));
            return new ChatResponse(
                List.of(new Generation(new AssistantMessage(text))),
                ChatResponseMetadata.builder().usage(usage).build()
            );
        }

        Prompt lastPrompt() {
            return lastPrompt;
        }

        int calls() {
            return calls.get();
        }

        void reportTokens(long tokens) {
            this.tokensPerReply = tokens;
        }
    }
}
