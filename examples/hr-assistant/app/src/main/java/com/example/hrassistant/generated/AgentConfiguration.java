// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package com.example.hrassistant.generated;

import com.example.hrassistant.generated.tool.BookDayOffTool;
import com.example.hrassistant.generated.tool.LoggedToolCallback;
import com.example.hrassistant.generated.tool.RemainingDaysOffTool;
import com.example.hrassistant.generated.tool.ToolGuard;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires the chat client: system prompt, conversation memory and the tools the model may call. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AgentProperties.class)
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
        RemainingDaysOffTool remainingDaysOffTool,
        BookDayOffTool bookDayOffTool,
        ToolGuard toolGuard
    ) {
        return builder
            .defaultSystem(properties.systemPrompt())
            .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
            // Every call is logged: the tool and how long it took, never what it was given.
            .defaultTools(
                LoggedToolCallback.logged(toolGuard.guard(ToolCallbacks.from(remainingDaysOffTool, bookDayOffTool)))
            )
            .build();
    }
}
