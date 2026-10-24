// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package com.example.vaultdesk.generated;

import com.example.vaultdesk.generated.guard.Guardrails;
import com.example.vaultdesk.generated.privacy.PersonalData;
import com.example.vaultdesk.generated.tool.ToolGuard;
import com.example.vaultdesk.generated.tool.TransferStatusTool;
import com.example.vaultdesk.generated.tool.TransferStatusToolProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.stream.Stream;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Wires the chat client: system prompt, conversation memory and the tools the model may call. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({ AgentProperties.class, TransferStatusToolProperties.class })
@EnableScheduling
class AgentConfiguration {

    @Bean
    ChatMemory chatMemory(ChatMemoryRepository repository, AgentProperties properties) {
        // The repository is Spring AI's JDBC one: conversations survive restarts.
        return MessageWindowChatMemory.builder()
            .chatMemoryRepository(repository)
            .maxMessages(properties.memory().window())
            .build();
    }

    @Bean
    ChatClient chatClient(
        ChatClient.Builder builder,
        ChatMemory chatMemory,
        AgentProperties properties,
        TransferStatusTool transferStatusTool,
        ToolGuard toolGuard,
        Guardrails guardrails
    ) throws IOException {
        // What the model must know about the guards of the agent comes after the system prompt.
        return builder
            .defaultSystem(
                properties.systemPrompt().getContentAsString(StandardCharsets.UTF_8) +
                    PersonalData.PROMPT_NOTE +
                    ToolGuard.PROMPT_NOTE +
                    guardrails.promptNote()
            )
            .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
            .defaultToolCallbacks(
                toolGuard.guard(
                    Stream.of(Arrays.stream(ToolCallbacks.from(transferStatusTool)))
                        .flatMap(tools -> tools)
                        .toArray(ToolCallback[]::new)
                )
            )
            .build();
    }
}
