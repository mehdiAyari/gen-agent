// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package com.example.petstoreassistant.generated;

import com.example.petstoreassistant.generated.chat.CurrentDateAdvisor;
import com.example.petstoreassistant.generated.tool.FindPetsByStatusTool;
import com.example.petstoreassistant.generated.tool.FindPetsByStatusToolProperties;
import com.example.petstoreassistant.generated.tool.GetPetByIdTool;
import com.example.petstoreassistant.generated.tool.GetPetByIdToolProperties;
import com.example.petstoreassistant.generated.tool.LoggedToolCallback;
import java.time.Clock;
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
@EnableConfigurationProperties({
    AgentProperties.class,
    FindPetsByStatusToolProperties.class,
    GetPetByIdToolProperties.class,
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
        FindPetsByStatusTool findPetsByStatusTool,
        GetPetByIdTool getPetByIdTool
    ) {
        return builder
            .defaultSystem(properties.systemPrompt())
            .defaultAdvisors(
                MessageChatMemoryAdvisor.builder(chatMemory).build(),
                new CurrentDateAdvisor(Clock.system(properties.timeZone()))
            )
            // Every call is logged: the tool and how long it took, never what it was given.
            .defaultTools(LoggedToolCallback.logged(ToolCallbacks.from(findPetsByStatusTool, getPetByIdTool)))
            .build();
    }
}
