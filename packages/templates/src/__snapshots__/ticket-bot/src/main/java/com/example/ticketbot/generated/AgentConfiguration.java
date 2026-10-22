// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package com.example.ticketbot.generated;

import com.example.ticketbot.generated.tool.CreateTicketTool;
import com.example.ticketbot.generated.tool.CreateTicketToolProperties;
import com.example.ticketbot.generated.tool.ServiceStatusTool;
import com.example.ticketbot.generated.tool.ServiceStatusToolProperties;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires the chat client: system prompt, conversation memory and the tools the model may call. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({
    AgentProperties.class,
    CreateTicketToolProperties.class,
    ServiceStatusToolProperties.class,
})
class AgentConfiguration {

    @Bean
    ChatMemory chatMemory(AgentProperties properties) {
        return MessageWindowChatMemory.builder()
            .chatMemoryRepository(new InMemoryChatMemoryRepository())
            .maxMessages(properties.memory().window())
            .build();
    }

    @Bean
    ChatClient chatClient(
        ChatClient.Builder builder,
        ChatMemory chatMemory,
        AgentProperties properties,
        CreateTicketTool createTicketTool,
        ServiceStatusTool serviceStatusTool
    ) {
        return builder
            .defaultSystem(properties.systemPrompt())
            .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
            .defaultTools(createTicketTool, serviceStatusTool)
            .build();
    }
}
