// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import com.example.hrassistant.generated.limits.LimitExceededException;
import com.example.hrassistant.generated.security.SecurityConfiguration;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
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
    @ExtendWith(OutputCaptureExtension.class)
    void logsHowLongTheAnswerTookNeverWhatItSays(CapturedOutput output) {
        given(chatService.reply(any(), eq("ada"))).willReturn(
            new ChatMessageResponse("c1", "Your IBAN is FR7630006000011234567890189")
        );

        assertThat(
            mockMvc
                .post()
                .uri("/api/chat")
                .with(jwt().jwt(token -> token.subject("ada")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"message": "What is my IBAN?"}
                    """
                )
        ).hasStatusOk();
        assertThat(output).contains("Answered in").doesNotContain("IBAN");
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
            .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
            .bodyJson()
            .extractingPath("$.detail")
            .isEqualTo("message: must not be blank");
    }

    @Test
    void answers503WhenAServiceItNeedsIsDownWithoutSayingWhich() {
        given(chatService.reply(any(), eq("ada"))).willThrow(
            new DataAccessResourceFailureException("Connection refused: redis:6379")
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
            .hasStatus(HttpStatus.SERVICE_UNAVAILABLE)
            .hasHeader("Retry-After", "30")
            .bodyJson()
            .extractingPath("$.detail")
            .asString()
            .doesNotContain("redis");
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
