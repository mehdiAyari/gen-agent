// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package com.example.supportdesk.generated;

import com.example.supportdesk.generated.tool.OrderStatusTool;
import com.example.supportdesk.generated.tool.OrderStatusToolProperties;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires the chat client: system prompt, conversation memory and the tools the model may call. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({ AgentProperties.class, OrderStatusToolProperties.class })
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
        OrderStatusTool orderStatusTool
    ) {
        return builder
            .defaultSystem(properties.systemPrompt())
            .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
            .defaultTools(orderStatusTool)
            .build();
    }
}
