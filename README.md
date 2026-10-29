# gen-agent

> Turn an API into a Spring AI agent, or describe one: get a production-ready Spring Boot project.

gen-agent is an open source generator of [Spring AI](https://spring.io/projects/spring-ai) agents, in the spirit of
JHipster. Describe your agent in an `agent.yaml` (or point at an OpenAPI spec) and get a Spring Boot 4 project that
compiles, passes its tests and runs, with what production needs already wired: personal data, guardrails, resilience,
observability, evaluations.

![An existing API becomes an agent: the Petstore spec imported, the project generated, a local model calling the API](docs/demo/openapi-demo.gif)

## Quick start

```bash
npx gen-agent new my-assistant          # answer a few questions, or: npx gen-agent generate --from agent.yaml
cd my-assistant
./mvnw spring-boot:run                  # then: curl localhost:8080/api/chat -d '{"message": "Hello"}' -H 'Content-Type: application/json'
```

Also as a [web generator](docs/guide.md#web-generator) that runs entirely in your browser, and as an
[MCP server](docs/guide.md#from-your-coding-assistant-mcp) for Claude Code, Cursor or any coding assistant.

## What the agent comes with

| Profile      | Adds                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `minimal`    | a `ChatClient` with memory and tools (HTTP, Java, MCP), `POST /api/chat`, tests with a fake model that never call a provider                                                               |
| `standard`   | Postgres or Redis memory, OIDC sign-in, limits per user, cache, OpenTelemetry and Grafana, a chat page, Dockerfile and Docker Compose                                                      |
| `production` | personal data masked and erasable, prompt injection guards, fallback models and circuit breakers, human approval, kill switches, a Helm chart, evaluations and red teaming on Ollama in CI |

Every piece can be turned on or off on its own in `agent.yaml`: RAG on your documents (pgvector), model routing,
remote MCP servers, Gradle instead of Maven… The [guide](docs/guide.md) shows each one.

## Why it is trustworthy

- **The generated code reads like hand-written Spring:** constructor injection, records, `@ConfigurationProperties`,
  sorted imports, no dead code. Your code and the generated code never mix, so regenerating is safe
  ([ADR 0001](docs/adr/0001-separate-generated-and-user-code.md)).
- **Tested for real:** eight reference agents, and one made from the public Petstore spec, are generated and built
  with `./mvnw verify` or `./gradlew build` (against real Postgres and Redis containers) on every change; the features
  were tried with a local model (Ollama), the Helm chart on a local Kubernetes cluster.
- **No secret in `agent.yaml`:** only the names of environment variables; API keys pasted in clear are refused.

## Learn more

[Guide](docs/guide.md) · [Changelog](CHANGELOG.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md) ·
[Architecture decisions](docs/adr/)

## License

[Apache License 2.0](LICENSE)
