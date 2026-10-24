// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import com.example.vaultdesk.generated.guard.RequestTimeout;
import com.example.vaultdesk.generated.limits.LimitExceededException;
import com.example.vaultdesk.generated.security.SecurityConfiguration;
import java.time.Duration;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@WebMvcTest(
    controllers = ChatController.class,
    properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.org"
)
@Import(SecurityConfiguration.class)
class ChatControllerTests {

    @Autowired
    MockMvcTester mockMvc;

    @MockitoBean
    ChatService chatService;

    @MockitoBean
    RequestTimeout requestTimeout;

    @BeforeEach
    void runRequestsRightAway() {
        // The timeout itself is covered by the tests of the application.
        given(requestTimeout.call(any())).willAnswer(call -> call.<Callable<?>>getArgument(0).call());
    }

    @Test
    void returnsTheReplyOfTheAgent() {
        given(chatService.reply(any(), eq("ada"))).willReturn(new ChatMessageResponse("c1", "Hi!"));

        assertThat(
            mockMvc
                .post()
                .uri("/api/chat")
                .with(jwt().jwt(token -> token.subject("ada")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"message": "Hello"}
                    """
                )
        )
            .hasStatusOk()
            .bodyJson()
            .extractingPath("$.reply")
            .isEqualTo("Hi!");
    }

    @Test
    void rejectsABlankMessageWithAProblemDetail() {
        assertThat(
            mockMvc
                .post()
                .uri("/api/chat")
                .with(jwt().jwt(token -> token.subject("ada")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"message": " "}
                    """
                )
        )
            .hasStatus(HttpStatus.BAD_REQUEST)
            .hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
    }

    @Test
    void hidesInternalErrorsBehindAGenericProblemDetail() {
        given(chatService.reply(any(), eq("ada"))).willThrow(
            new IllegalStateException("connection refused to internal host")
        );

        assertThat(
            mockMvc
                .post()
                .uri("/api/chat")
                .with(jwt().jwt(token -> token.subject("ada")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"message": "Hello"}
                    """
                )
        )
            .hasStatus(HttpStatus.INTERNAL_SERVER_ERROR)
            .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
            .bodyText()
            .doesNotContain("internal host");
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
    void answersNotFoundForAConversationOfSomeoneElse() {
        given(chatService.reply(any(), eq("ada"))).willThrow(new UnknownConversationException("c1"));

        assertThat(
            mockMvc
                .post()
                .uri("/api/chat")
                .with(jwt().jwt(token -> token.subject("ada")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"conversationId": "c1", "message": "Hello"}
                    """
                )
        )
            .hasStatus(HttpStatus.NOT_FOUND)
            .hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
    }

    @Test
    void tellsWhenToComeBackOnceALimitIsReached() {
        given(chatService.reply(any(), eq("ada"))).willThrow(
            new LimitExceededException("Too many requests", Duration.ofMillis(1500))
        );

        assertThat(
            mockMvc
                .post()
                .uri("/api/chat")
                .with(jwt().jwt(token -> token.subject("ada")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"message": "Hello"}
                    """
                )
        )
            .hasStatus(HttpStatus.TOO_MANY_REQUESTS)
            .hasHeader(HttpHeaders.RETRY_AFTER, "2");
    }
}
