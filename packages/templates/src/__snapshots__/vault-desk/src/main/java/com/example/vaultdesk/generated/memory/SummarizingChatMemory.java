// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.memory;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;

/**
 * Keeps the last messages of each conversation as they are and the older ones as a summary written by the model, so
 * that a long conversation keeps its facts without sending them all again. When the model cannot summarize, the oldest
 * messages are dropped instead.
 */
public class SummarizingChatMemory implements ChatMemory {

    private static final Logger log = LoggerFactory.getLogger(SummarizingChatMemory.class);

    private static final String SUMMARY = "Summary of the earlier conversation: ";

    private static final String INSTRUCTIONS = """
    Summarize this conversation in a few sentences for the assistant who will continue it. Keep names, facts, \
    numbers, decisions and open questions; keep tokens such as [EMAIL_1] exactly as they are.

    %s""";

    private final ChatMemoryRepository repository;

    private final ChatModel chatModel;

    private final int window;

    private final String model;

    public SummarizingChatMemory(ChatMemoryRepository repository, ChatModel chatModel, int window, String model) {
        this.repository = repository;
        this.chatModel = chatModel;
        this.window = window;
        this.model = model;
    }

    @Override
    public void add(String conversationId, List<Message> messages) {
        List<Message> all = new ArrayList<>(repository.findByConversationId(conversationId));
        all.addAll(messages);
        if (all.size() > window) {
            // Half of the window stays word for word; the rest, an earlier summary included, becomes one summary.
            int kept = window / 2;
            List<Message> older = all.subList(0, all.size() - kept);
            List<Message> recent = all.subList(all.size() - kept, all.size());
            all = Stream.concat(summaryOf(older).stream(), recent.stream()).toList();
        }
        repository.saveAll(conversationId, all);
    }

    @Override
    public List<Message> get(String conversationId) {
        return repository.findByConversationId(conversationId);
    }

    @Override
    public void clear(String conversationId) {
        repository.deleteByConversationId(conversationId);
    }

    private Optional<Message> summaryOf(List<Message> messages) {
        String transcript = messages
            .stream()
            .map(message -> message.getMessageType().getValue() + ": " + message.getText())
            .collect(Collectors.joining("\n"));
        try {
            String summary = chatModel
                .call(
                    new Prompt(INSTRUCTIONS.formatted(transcript), chatModel.getOptions().mutate().model(model).build())
                )
                .getResult()
                .getOutput()
                .getText();
            return summary == null ? Optional.empty() : Optional.of(new SystemMessage(SUMMARY + summary));
        } catch (RuntimeException failure) {
            log.warn("Could not summarize the conversation, its oldest messages are dropped: {}", failure.toString());
            return Optional.empty();
        }
    }
}
