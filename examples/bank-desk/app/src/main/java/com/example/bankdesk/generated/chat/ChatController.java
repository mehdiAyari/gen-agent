// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.chat;

import com.example.bankdesk.generated.guard.RequestTimeout;
import jakarta.validation.Valid;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final ChatService chatService;

    private final RequestTimeout requestTimeout;

    ChatController(ChatService chatService, RequestTimeout requestTimeout) {
        this.chatService = chatService;
        this.requestTimeout = requestTimeout;
    }

    @PostMapping
    ChatMessageResponse chat(@Valid @RequestBody ChatMessageRequest request, @AuthenticationPrincipal Jwt user) {
        long start = System.nanoTime();
        ChatMessageResponse response = requestTimeout.call(() -> chatService.reply(request, user.getSubject()));
        // How long the answer took, never what it says.
        log.info("Answered in {} ms", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start));
        return response;
    }
}
