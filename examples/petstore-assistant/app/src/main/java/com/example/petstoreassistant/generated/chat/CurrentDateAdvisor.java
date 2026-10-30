// Managed by gen-agent: changes here are overwritten. Set the time zone in application.yml.
package com.example.petstoreassistant.generated.chat;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.core.Ordered;

/**
 * Tells the model the date of the day, in the time zone of the users ({@code agent.time-zone}): without it, "tomorrow"
 * or "next Friday" are guesses.
 */
public class CurrentDateAdvisor implements CallAdvisor {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.ENGLISH);

    private final Clock clock;

    public CurrentDateAdvisor(Clock clock) {
        this.clock = clock;
    }

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest request, CallAdvisorChain chain) {
        String today = "\n\nToday is " + LocalDate.now(clock).format(DATE) + " (" + clock.getZone().getId() + ").";
        return chain.nextCall(
            request
                .mutate()
                .prompt(
                    request.prompt().augmentSystemMessage(system ->
                        system
                            .mutate()
                            .text(system.getText() + today)
                            .build()
                    )
                )
                .build()
        );
    }

    @Override
    public String getName() {
        return "current-date";
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
