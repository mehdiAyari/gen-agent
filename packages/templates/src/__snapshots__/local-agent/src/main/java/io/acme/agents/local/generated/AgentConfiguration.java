// Managed by gen-agent: changes here are overwritten. Edit agent.yaml and regenerate.
package io.acme.agents.local.generated;

import io.acme.agents.local.generated.tool.CurrentTimeTool;
import io.acme.agents.local.generated.tool.LoggedToolCallback;
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
@EnableConfigurationProperties(AgentProperties.class)
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
        CurrentTimeTool currentTimeTool
    ) {
        return builder
            .defaultSystem(properties.systemPrompt())
            .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
            // Every call is logged: the tool and how long it took, never what it was given.
            .defaultTools(LoggedToolCallback.logged(ToolCallbacks.from(currentTimeTool)))
            .build();
    }
}
