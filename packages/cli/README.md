# gen-agent

> Describe your agent, get a production-ready Spring AI project.

```bash
npx gen-agent new my-assistant           # answer a few questions
npx gen-agent generate --from agent.yaml # or describe the agent in a file
```

The generated project uses Spring Boot 4.1.1, Spring AI 2.0.1 and Java 21, ships the Maven Wrapper, and passes
`./mvnw verify` out of the box with a fake model (no provider call, no cost).

```yaml
agent:
  name: hr-assistant
  description: Internal HR assistant
  model:
    provider: mistral # openai | anthropic | mistral | ollama
    name: mistral-large-latest
  tools:
    - name: weather-forecast
      type: http
      description: Weather forecast for a location
      url: https://api.open-meteo.com/v1/forecast
      params:
        - { name: latitude, type: number, required: true }
        - { name: longitude, type: number, required: true }
```

V1 generates the `minimal` profile: chat client with a system prompt file, conversation memory, HTTP and Java tools,
a REST endpoint. Features of later versions (RAG, MCP, security, cache…) are validated and refused with the version that
brings them.

License: Apache 2.0.
