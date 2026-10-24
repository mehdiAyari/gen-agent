// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.chat;

import com.example.vaultdesk.generated.AgentProperties;
import java.text.Normalizer;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Chooses the model of each message: the simple one unless the message is long, holds code, asks several questions or
 * asks for reasoning (explain, compare, analyse… in English or French), which go to the complex one.
 */
@Component
class ModelRouter {

    private static final int LONG_MESSAGE = 400;

    private static final Pattern CODE = Pattern.compile(
        "```|\\b(?:class|def|function|SELECT|import)\\b|[{};]\\s*$",
        Pattern.MULTILINE
    );

    private static final Pattern REASONING = Pattern.compile(
        "\\b(?:explain|compare|analy[sz]e|why|plan|step by step|pros and cons|expliqu|compar|analys|pourquoi|etape par etape|avantages et inconvenients)",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private final String simple;

    private final String complex;

    ModelRouter(AgentProperties properties) {
        this.simple = properties.routing().simple();
        this.complex = properties.routing().complex();
    }

    String modelFor(String message) {
        String plain = Normalizer.normalize(message, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        boolean complexMessage =
            message.length() > LONG_MESSAGE ||
            CODE.matcher(message).find() ||
            message
                .chars()
                .filter(c -> c == '?')
                .count() > 1 ||
            REASONING.matcher(plain).find();
        return complexMessage ? complex : simple;
    }
}
