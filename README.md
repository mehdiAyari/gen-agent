# gen-agent

> Describe your agent, get a production-ready Spring AI project.

gen-agent is an open source generator of [Spring AI](https://spring.io/projects/spring-ai) agents, in the spirit of
JHipster: describe your agent in an `agent.yaml` file (or answer a few questions) and get a complete Spring Boot project
that compiles, passes its tests and runs.

**Status: V1** — `minimal` profile, command line only. See [what V1 does not do yet](#limits-of-v1).

## Quick start

```bash
npx gen-agent new my-assistant          # answer a few questions
npx gen-agent generate --from agent.yaml
```

Then:

```bash
cd my-assistant
export MISTRAL_API_KEY=...              # or OPENAI_API_KEY, ANTHROPIC_API_KEY; nothing for Ollama
mvn spring-boot:run
curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d '{"message": "Hello"}'
```

## Describe your agent

```yaml
agent:
  name: hr-assistant
  description: Internal HR assistant
  model:
    provider: mistral # openai | anthropic | mistral | ollama
    name: mistral-large-latest
    temperature: 0.3
  tools:
    - name: weather-forecast
      type: http
      description: Weather forecast for a location
      url: https://api.open-meteo.com/v1/forecast
      params:
        - { name: latitude, type: number, required: true }
        - { name: longitude, type: number, required: true }
    - name: book-leave
      type: java
      description: Books a day off for the current employee
      params:
        - { name: date, type: string, required: true }
  gdpr:
    euOnly: true # refuses providers hosted outside the EU
```

The file is validated before anything is written: unknown keys, wrong values and API keys pasted in clear are refused,
with the line of each error. Its JSON Schema (`packages/core/schema/agent.schema.json`) gives validation and
autocompletion in your editor.

## What you get

A Spring Boot 4.1.1 / Spring AI 2.0.1 / Java 21 Maven project:

- a `ChatClient` with the system prompt in `src/main/resources/prompts/system.md` and a windowed conversation memory;
- `POST /api/chat`, validated input, errors as `ProblemDetail`, replies flagged `"aiGenerated": true` (EU AI Act);
- each HTTP tool as a `RestClient` call with its URL in `application.yml`; each Java tool as an interface you implement;
- tests that start the application with a fake model: `mvn verify` never calls a provider and costs nothing.

Generated code and your code never mix: everything under `…generated` belongs to gen-agent, the tool implementations
and the system prompt belong to you, and `.gen-agent.json` records who owns each file and its fingerprint, so future
versions can regenerate safely ([ADR 0001](docs/adr/0001-separate-generated-and-user-code.md)).

## Limits of V1

- Only the `minimal` profile. A valid `agent.yaml` may describe the whole specification (`profile: production`, RAG,
  MCP, security, cache…); gen-agent then refuses to generate and says which version brings each feature.
- Maven only; Spring AI version pinned to 2.0.1.
- `generate` writes into a new or empty directory; `add` and `upgrade` come later.

## Contributing

Node 22+, pnpm, JDK 21 and Maven.

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test   # unit and snapshot tests
pnpm e2e                                   # generates the reference projects and runs mvn verify on each
```

| Package              | Role                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| `packages/core`      | `agent.yaml` schema and rules, normalized model, rendering (Node and browser) |
| `packages/templates` | templates of the `minimal` profile, reference agents and their snapshots      |
| `packages/cli`       | the `gen-agent` command                                                       |
| `e2e`                | builds the reference projects with Maven                                      |

## License

[Apache License 2.0](LICENSE)
