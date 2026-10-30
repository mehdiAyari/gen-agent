// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package com.example.hrassistant.generated;

import com.example.hrassistant.generated.tool.BookLeaveTool;
import com.example.hrassistant.generated.tool.LoggedToolCallback;
import com.example.hrassistant.generated.tool.WeatherForecastTool;
import com.example.hrassistant.generated.tool.WeatherForecastToolProperties;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires the chat client: system prompt, conversation memory and the tools the model may call. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({ AgentProperties.class, WeatherForecastToolProperties.class })
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
        WeatherForecastTool weatherForecastTool,
        BookLeaveTool bookLeaveTool
    ) {
        return builder
            .defaultSystem(properties.systemPrompt())
            .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
            // Every call is logged: the tool and how long it took, never what it was given.
            .defaultToolCallbacks(LoggedToolCallback.logged(ToolCallbacks.from(weatherForecastTool, bookLeaveTool)))
            .build();
    }
}
