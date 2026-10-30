// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package com.example.claimsdesk.generated;

import com.example.claimsdesk.generated.chat.CurrentDateAdvisor;
import com.example.claimsdesk.generated.guard.Guardrails;
import com.example.claimsdesk.generated.memory.SummarizingChatMemory;
import com.example.claimsdesk.generated.privacy.PersonalData;
import com.example.claimsdesk.generated.resilience.ResilientModelAdvisor;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires the chat client: system prompt, conversation memory and the tools the model may call. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AgentProperties.class)
class AgentConfiguration {

    @Bean
    ChatMemory chatMemory(ChatMemoryRepository repository, ChatModel chatModel, AgentProperties properties) {
        // Older messages are summarized by the model of simple messages instead of being forgotten.
        return new SummarizingChatMemory(
            repository,
            chatModel,
            properties.memory().window(),
            properties.routing().simple()
        );
    }

    @Bean
    ChatClient chatClient(
        ChatClient.Builder builder,
        ChatMemory chatMemory,
        AgentProperties properties,
        Guardrails guardrails,
        ResilientModelAdvisor resilientModelAdvisor
    ) throws IOException {
        // What the model must know about the guards of the agent comes after the system prompt.
        return builder
            .defaultSystem(
                properties.systemPrompt().getContentAsString(StandardCharsets.UTF_8) +
                    PersonalData.PROMPT_NOTE +
                    guardrails.promptNote()
            )
            .defaultAdvisors(
                MessageChatMemoryAdvisor.builder(chatMemory).build(),
                new CurrentDateAdvisor(Clock.system(properties.timeZone())),
                resilientModelAdvisor
            )
            .build();
    }
}
