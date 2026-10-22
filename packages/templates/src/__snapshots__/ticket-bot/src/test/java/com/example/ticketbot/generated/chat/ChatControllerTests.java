// Managed by gen-agent: changes here are overwritten.
package com.example.ticketbot.generated.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@WebMvcTest(ChatController.class)
class ChatControllerTests {

    @Autowired
    MockMvcTester mockMvc;

    @MockitoBean
    ChatService chatService;

    @Test
    void returnsTheReplyOfTheAgent() {
        given(chatService.reply(any())).willReturn(new ChatMessageResponse("c1", "Hi!"));

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
}
