// Managed by gen-agent: changes here are overwritten.
package com.example.docshelper;

import com.example.docshelper.generated.TestcontainersConfiguration;
import org.springframework.boot.SpringApplication;

/** Runs the agent with its Postgres started in Docker, as the tests do: {@code ./gradlew bootTestRun}. */
public class TestDocsHelperApplication {

    public static void main(String[] args) {
        SpringApplication.from(DocsHelperApplication::main).with(TestcontainersConfiguration.class).run(args);
    }
}
