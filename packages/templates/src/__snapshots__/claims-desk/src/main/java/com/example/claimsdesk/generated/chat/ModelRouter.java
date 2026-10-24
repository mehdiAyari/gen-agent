// Managed by gen-agent: changes here are overwritten.
package com.example.claimsdesk.generated.chat;

import com.example.claimsdesk.generated.AgentProperties;
import java.util.Locale;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Component;

/**
 * Chooses the model of each message: the simple model first tells whether the message is simple or complex. When it
 * cannot tell, the complex model answers.
 */
@Component
class ModelRouter {

    private static final String QUESTION = """
    Is the following request simple (a greeting, a short factual question, a lookup) or complex (reasoning, \
    several steps, writing, code)? Answer with one word: simple or complex.

    Request: %s""";

    private final ChatModel chatModel;

    private final String simple;

    private final String complex;

    ModelRouter(ChatModel chatModel, AgentProperties properties) {
        this.chatModel = chatModel;
        this.simple = properties.routing().simple();
        this.complex = properties.routing().complex();
    }

    String modelFor(String message) {
        try {
            String verdict = chatModel
                .call(new Prompt(QUESTION.formatted(message), chatModel.getOptions().mutate().model(simple).build()))
                .getResult()
                .getOutput()
                .getText();
            return verdict != null && verdict.strip().toLowerCase(Locale.ROOT).startsWith("simple") ? simple : complex;
        } catch (RuntimeException failure) {
            // Unsure: the complex model answers.
            return complex;
        }
    }
}
