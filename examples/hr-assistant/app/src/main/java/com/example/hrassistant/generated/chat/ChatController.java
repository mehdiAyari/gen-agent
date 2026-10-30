// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.chat;

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

    ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping
    ChatMessageResponse chat(@Valid @RequestBody ChatMessageRequest request, @AuthenticationPrincipal Jwt user) {
        long start = System.nanoTime();
        ChatMessageResponse response = chatService.reply(request, user.getSubject());
        // How long the answer took, never what it says.
        log.info("Answered in {} ms", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start));
        return response;
    }
}
