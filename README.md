# gen-agent

[![CI](https://github.com/mehdiAyari/gen-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/mehdiAyari/gen-agent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Spring AI](https://img.shields.io/badge/Spring%20AI-2.0.1-6db33f.svg)](https://spring.io/projects/spring-ai)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://openjdk.org/projects/jdk/21/)

> Describe an agent in one file, or point at an OpenAPI spec: get a Spring AI project that is secure, observable and
> tested, as a good Spring developer would have written it.

[Spring AI](https://spring.io/projects/spring-ai) gives the building blocks of an agent. Wiring them for production —
sign-in, limits per user, personal data kept from the model, guards against prompt injection, human approval of
sensitive tools, fallback models, traces, evaluations, deployment — takes weeks for each agent. gen-agent generates all
of it from an `agent.yaml`, in the spirit of JHipster: plain Spring code that you own, separated from yours so that
regenerating never touches it. One engine drives a CLI, a web generator and an MCP server for coding assistants.

**Status:** version 0.1.0, under active development. Not on npm yet: run it from the sources (below). Apache 2.0.

| Web generator: an OpenAPI spec imported in the browser                                                         | CLI: the Petstore API becomes an agent, answering on a local model                                          |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ![The web generator imports the Petstore spec and previews the generated tool](docs/demo/openapi-web-demo.gif) | ![The Petstore spec imported, the project generated, the agent calling the API](docs/demo/openapi-demo.gif) |

## Try it

Node 22 and Java 21; [Ollama](https://ollama.com) to talk to the agent without an API key.

```bash
git clone https://github.com/mehdiAyari/gen-agent.git && cd gen-agent
corepack enable && pnpm install && pnpm build
alias gen-agent="node $PWD/packages/cli/dist/bin.js"

cd .. && gen-agent new my-assistant           # a few questions: provider, model, tools
cd my-assistant && ./mvnw verify              # its tests run with a fake model: no provider called
./mvnw spring-boot:run
curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d '{"message": "Hello"}'
```

Or describe the agent yourself and run `gen-agent generate --from agent.yaml`, or open the web generator
(`pnpm --filter @gen-agent/web dev`), which builds the same project in the browser. The [guide](docs/guide.md) covers
every option.

## What one file asks for

```yaml
agent:
  name: bank-desk
  profile: production # minimal | standard | production: each piece can still be set on its own
  model:
    provider: ollama # or openai, anthropic, mistral
    name: qwen2.5:7b
    fallback: { provider: ollama, name: qwen2.5:3b }
  tools:
    - name: send-transfer
      type: java # a handler you implement; or http, or imported from an OpenAPI spec
      description: Sends a transfer from the account of the signed-in customer
      approval: { required: true }
      params:
        - { name: iban, type: string, required: true }
        - { name: amount, type: number, required: true }
  mcp:
    - { name: time, package: mcp-server-time, version: 2026.10.19, runtime: python }
  interface: [rest, chat-ui]
  deploy: [docker-compose, helm]
```

## What the generated agent does

| Area             | What you get                                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Models           | Ollama locally with no key, OpenAI, Anthropic or Mistral; routing of simple messages to a smaller model; a fallback model behind circuit breakers, then a fallback answer                      |
| Tools            | HTTP tools with authentication from environment variables, Java tools you implement, tools imported from an OpenAPI spec, MCP servers in hardened containers or remote over HTTP               |
| Security         | OIDC sign-in with conversations bound to their user, request and token limits per user, prompt injection refused before the model, answers leaking the system prompt refused, security headers |
| Human control    | Tool calls that wait for the user's approval in the chat page, kill switches for the agent and each tool                                                                                       |
| Personal data    | Emails, phones, IBANs and card numbers replaced by tokens before the model and in the logs, put back for the user; erasure endpoints; conversations purged after their retention               |
| Answers and cost | Conversation memory in memory, Postgres or Redis, with summaries; an exact and a semantic cache, both per user; RAG on PDF, Word, HTML and Markdown documents in pgvector                      |
| Operations       | OpenTelemetry traces and metrics, a Grafana dashboard, logs without personal data; Dockerfile, Docker Compose with Postgres, Redis and Keycloak, a Helm chart                                  |
| Quality          | Tests with a fake model in every project; evaluations on a reference set and a red team of attacks, run on Ollama by `./mvnw verify -Pevals` and a generated GitHub Actions workflow           |

Generated code reads like code a Spring developer wrote: constructor injection, records, `@ConfigurationProperties`,
sorted imports, no dead code. Your files are never rewritten, and a shared file you changed gets the new version next to
it ([ADR 0001](docs/adr/0001-separate-generated-and-user-code.md)).

| Human approval in the chat page (Keycloak sign-in, a day off booked once approved)           | Personal data: the model sees `[IBAN_1]`, the logs `[IBAN]`, the database the real IBAN                |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ![Sign-in, a request, the approval card, the day off booked](examples/hr-assistant/demo.gif) | ![A transfer approved, the IBAN masked in the logs, an injection refused](examples/bank-desk/demo.gif) |

![The generated Grafana dashboard: requests, model calls, tokens, tool calls, guard refusals, feedback, circuit breakers](examples/bank-desk/dashboard.png)

## Examples

Complete agents, each with the commands that made it ([`make.sh`](examples/petstore-assistant/make.sh)), the code
written by hand afterwards, and a recording of a real run on Ollama.

| Example                                           | Shows                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [petstore-assistant](examples/petstore-assistant) | An existing API turned into an agent from its OpenAPI spec: two commands, no Java written       |
| [hr-assistant](examples/hr-assistant)             | Business code written by hand: days off booked only after the employee approves them            |
| [docs-analyst](examples/docs-analyst)             | Answers from Markdown and PDF documents, "the handbook does not say" otherwise; evaluations 6/6 |
| [bank-desk](examples/bank-desk)                   | The `production` profile: personal data, approval, guards, dashboard, Helm; red team 10/10      |

## How it is tested

| What                                                                                                                                                              | When         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Unit tests of the schema, the model, the templates, the CLI, the web generator and the MCP server                                                                 | every change |
| 150 random `agent.yaml` files: no template residue, no dead import, valid YAML and JSON, variables documented                                                     | every change |
| A pairwise sample of every option, 8 reference agents, one made from the Petstore spec and the 4 examples, built with their tests against real Postgres and Redis | every change |
| Projects downloaded from the web generator, identical to the CLI output, then built                                                                               | every change |
| A clean room with only Java and Node: the packed npm package installs, a Maven and a Gradle project build                                                         | every change |
| Agents started for real on Ollama and asked questions                                                                                                             | every change |
| Dependencies cut on a running agent, OWASP ZAP, prompt attacks, Anthropic and a kind cluster                                                                      | by hand      |

## Limits

- Prompt injection detection uses patterns: it caught 8 of 30 attacks it was not written from, with no false alarm on
  40 ordinary messages. What holds when it misses is enforced in code: a sensitive tool call waits for the user's
  approval, kill switches stop the agent, and answers that repeat the system prompt are refused on the way out.
- Personal data is found with patterns too: names and postal addresses are not.
- A small local model is slow on a laptop CPU and makes mistakes a hosted model does not; the evaluations measure it.
- Tested on Linux; Windows and macOS have not been tried.

## Learn more

[Guide](docs/guide.md) · [Examples](examples/) · [Specification](docs/specification.md) · [Changelog](CHANGELOG.md) ·
[Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) ·
[Architecture decisions](docs/adr/)

Licensed under the [Apache License 2.0](LICENSE).
