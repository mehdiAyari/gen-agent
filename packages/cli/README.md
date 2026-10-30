# gen-agent

> Turn an API into a Spring AI agent, or describe one: get a production-ready Spring Boot project.

```bash
npx gen-agent new my-assistant                  # answer a few questions
npx gen-agent generate --from agent.yaml        # or describe the agent in a file
npx gen-agent import openapi openapi.json       # an existing API becomes tools
```

The generated project uses Spring Boot 4.1.1, Spring AI 2.0.1 and Java 21, ships the Maven or Gradle Wrapper, and
passes its tests out of the box with a fake model (no provider call, no cost).

```yaml
agent:
  name: hr-assistant
  description: Internal HR assistant
  profile: standard # minimal | standard | production
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

| Command                            | What it does                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `gen-agent new <name>`             | asks a few questions (none with `--provider`), writes agent.yaml and generates the project |
| `gen-agent generate --from <file>` | generates the project of an agent.yaml                                                     |
| `gen-agent import openapi <spec>`  | adds the operations of an OpenAPI 3 spec as HTTP tools                                     |
| `gen-agent add tool` / `add mcp`   | adds a tool or an MCP server, then updates the project                                     |
| `gen-agent update`                 | generates the project again, keeping your changes                                          |
| `gen-agent mcp`                    | runs gen-agent as an MCP server for coding assistants                                      |

Profiles go from a plain chat client with tools (`minimal`) to sign-in, limits, cache and observability (`standard`),
then personal data protection, guardrails, resilience, evaluations and a Helm chart (`production`).

Documentation: [github.com/mehdiAyari/gen-agent](https://github.com/mehdiAyari/gen-agent). License: Apache 2.0.
