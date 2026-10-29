// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.ui;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Settings of the chat page (src/main/resources/static), read by chat.js: public, they hold no secret. */
@RestController
class ChatUiController {

    private final ChatUiSettings settings;

    ChatUiController(
        @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
        @Value("${agent.chat-ui.client-id}") String clientId
    ) {
        this.settings = new ChatUiSettings("oidc", issuer, clientId, false);
    }

    @GetMapping("/chat-config.json")
    ChatUiSettings settings() {
        return settings;
    }

    /**
     * @param auth how users sign in: oidc, or none
     * @param issuer the OIDC provider the page signs users in with
     * @param clientId the public client of the page at that provider
     * @param feedback whether the page shows thumbs up and down under the answers
     */
    record ChatUiSettings(String auth, String issuer, String clientId, boolean feedback) {}
}
