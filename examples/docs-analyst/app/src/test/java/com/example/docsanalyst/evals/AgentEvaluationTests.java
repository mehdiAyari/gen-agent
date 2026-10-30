// Managed by gen-agent: changes here are overwritten. Write your cases in the reference set.
package com.example.docsanalyst.evals;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.docsanalyst.generated.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.yaml.snakeyaml.Yaml;
import tools.jackson.databind.json.JsonMapper;

/**
 * Scores the agent on a real model, Ollama, never in a plain ./mvnw verify: run ./mvnw verify -Pevals. Each case of
 * evals/golden.yaml is asked to the whole agent, guards included; the report
 * goes to target/evals-report.md.
 */
@Tag("evals")
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AgentEvaluationTests {

    record Result(String name, boolean passed, String detail) {}

    @Autowired
    MockMvcTester mockMvc;

    @Autowired
    ChatModel chatModel;

    private static final List<String> report = new CopyOnWriteArrayList<>();

    @Test
    @SuppressWarnings("unchecked")
    void answersTheReferenceSetWell() throws IOException {
        Map<String, Object> golden = new Yaml().load(Files.readString(Path.of("evals/golden.yaml")));
        double threshold = ((Number) golden.getOrDefault("threshold", 0.8)).doubleValue();
        List<Result> results = ((List<Map<String, Object>>) golden.get("cases")).stream().map(this::evaluate).toList();

        assertThat(score("Reference set", results))
            .as("share of the reference set answered well")
            .isGreaterThanOrEqualTo(threshold);
    }

    @SuppressWarnings("unchecked")
    private Result evaluate(Map<String, Object> testCase) {
        String question = (String) testCase.get("question");
        String answer = ask(question);
        String lower = answer.toLowerCase(Locale.ROOT);
        for (String word : (List<String>) testCase.getOrDefault("mustContain", List.of())) {
            if (!lower.contains(word.toLowerCase(Locale.ROOT))) {
                return new Result(question, false, "missing \"" + word + "\": " + excerpt(answer));
            }
        }
        for (String word : (List<String>) testCase.getOrDefault("mustNotContain", List.of())) {
            if (lower.contains(word.toLowerCase(Locale.ROOT))) {
                return new Result(question, false, "holds \"" + word + "\": " + excerpt(answer));
            }
        }
        String criterion = (String) testCase.get("criterion");
        if (criterion != null && !meets(question, answer, criterion)) {
            return new Result(question, false, "does not meet the criterion: " + excerpt(answer));
        }
        return new Result(question, true, "");
    }

    /** The model as a judge: a sentence of reasons first, then its verdict, without randomness. */
    private boolean meets(String question, String answer, String criterion) {
        String judgement = chatModel
            .call(
                new Prompt(
                    """
                    You check whether an answer meets a criterion.

                    Question: %s
                    Answer: %s
                    Criterion: %s

                    First explain in one sentence whether the answer meets the criterion. Then, on the last line, \
                    write exactly VERDICT: YES or VERDICT: NO.""".formatted(question, answer, criterion),
                    chatModel.getOptions().mutate().temperature(0.0).build()
                )
            )
            .getResult()
            .getOutput()
            .getText();
        return judgement != null && judgement.toUpperCase(Locale.ROOT).contains("VERDICT: YES");
    }

    private String ask(String question) {
        String request = "{\"message\": " + JsonMapper.shared().writeValueAsString(question) + "}";
        MockHttpServletResponse response = mockMvc
            .post()
            .uri("/api/chat")
            .contentType(MediaType.APPLICATION_JSON)
            .content(request)
            .exchange()
            .getResponse();
        String body = new String(response.getContentAsByteArray(), StandardCharsets.UTF_8);
        // An error is no answer: a problem detail, such as too many tool calls or a timeout.
        return response.getStatus() == 200
            ? JsonPath.read(body, "$.reply")
            : "[HTTP " + response.getStatus() + "] " + JsonPath.read(body, "$.detail");
    }

    /** The beginning of an answer, on one line, for the report. */
    private static String excerpt(String answer) {
        String line = answer.replaceAll("\\s+", " ").strip();
        return line.length() > 160 ? line.substring(0, 160) + "…" : line;
    }

    /** The share of results that passed, written to the report. */
    private static double score(String title, List<Result> results) throws IOException {
        long passed = results.stream().filter(Result::passed).count();
        double score = (double) passed / results.size();
        report.add(
            "## %s: %d/%d (%.0f%%)%n%n| | Case | Why |%n| --- | --- | --- |%n".formatted(
                title,
                passed,
                results.size(),
                score * 100
            ) +
                results
                    .stream()
                    .map(result ->
                        "| %s | %s | %s |".formatted(
                            result.passed() ? "pass" : "FAIL",
                            result.name().replace("|", "\\|"),
                            result.detail().replace("|", "\\|")
                        )
                    )
                    .collect(Collectors.joining("\n"))
        );
        Files.writeString(
            Path.of("target", "evals-report.md"),
            "# Evaluations of docs-analyst\n\n" + String.join("\n\n", report) + "\n"
        );
        System.out.println(report.getLast());
        return score;
    }
}
