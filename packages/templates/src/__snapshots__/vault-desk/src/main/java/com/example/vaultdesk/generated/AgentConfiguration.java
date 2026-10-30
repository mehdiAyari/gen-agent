// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package com.example.vaultdesk.generated;

import com.example.vaultdesk.generated.guard.Guardrails;
import com.example.vaultdesk.generated.memory.SummarizingChatMemory;
import com.example.vaultdesk.generated.privacy.PersonalData;
import com.example.vaultdesk.generated.resilience.ResilientModelAdvisor;
import com.example.vaultdesk.generated.tool.BlockCardTool;
import com.example.vaultdesk.generated.tool.LoggedToolCallback;
import com.example.vaultdesk.generated.tool.ToolGuard;
import com.example.vaultdesk.generated.tool.TransferStatusTool;
import com.example.vaultdesk.generated.tool.TransferStatusToolProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.support.ToolCallbacks;
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
        TransferStatusTool transferStatusTool,
        BlockCardTool blockCardTool,
        ToolGuard toolGuard,
        Guardrails guardrails,
        ResilientModelAdvisor resilientModelAdvisor
    ) throws IOException {
        // What the model must know about the guards of the agent comes after the system prompt.
        return builder
            .defaultSystem(
                properties.systemPrompt().getContentAsString(StandardCharsets.UTF_8) +
                    PersonalData.PROMPT_NOTE +
                    ToolGuard.PROMPT_NOTE +
                    guardrails.promptNote()
            )
            .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build(), resilientModelAdvisor)
            // Every call is logged: the tool and how long it took, never what it was given.
            .defaultToolCallbacks(
                LoggedToolCallback.logged(toolGuard.guard(ToolCallbacks.from(transferStatusTool, blockCardTool)))
            )
            .build();
    }
}
