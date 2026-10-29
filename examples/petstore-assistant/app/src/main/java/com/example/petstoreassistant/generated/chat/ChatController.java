// Managed by gen-agent: changes here are overwritten.
package com.example.petstoreassistant.generated.chat;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
class ChatController {

    private final ChatService chatService;

    ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping
    ChatMessageResponse chat(@Valid @RequestBody ChatMessageRequest request) {
        return chatService.reply(request);
    }
}
