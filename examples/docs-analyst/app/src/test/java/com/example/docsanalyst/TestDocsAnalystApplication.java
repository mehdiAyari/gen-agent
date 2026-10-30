// Managed by gen-agent: changes here are overwritten.
package com.example.docsanalyst;

import com.example.docsanalyst.generated.TestcontainersConfiguration;
import org.springframework.boot.SpringApplication;

/** Runs the agent with its Postgres started in Docker, as the tests do: {@code ./mvnw spring-boot:test-run}. */
public class TestDocsAnalystApplication {

    public static void main(String[] args) {
        SpringApplication.from(DocsAnalystApplication::main).with(TestcontainersConfiguration.class).run(args);
    }
}
