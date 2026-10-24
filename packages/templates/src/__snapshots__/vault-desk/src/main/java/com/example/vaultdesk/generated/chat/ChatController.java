// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.chat;

import com.example.vaultdesk.generated.guard.RequestTimeout;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
class ChatController {

    private final ChatService chatService;

    private final RequestTimeout requestTimeout;

    ChatController(ChatService chatService, RequestTimeout requestTimeout) {
        this.chatService = chatService;
        this.requestTimeout = requestTimeout;
    }

    @PostMapping
    ChatMessageResponse chat(@Valid @RequestBody ChatMessageRequest request, @AuthenticationPrincipal Jwt user) {
        return requestTimeout.call(() -> chatService.reply(request, user.getSubject()));
    }
}
