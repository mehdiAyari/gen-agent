# gen-agent — Specification

The design document gen-agent was built from. The format reference is [the guide](guide.md) and the JSON Schema
(`gen-agent validate`); the order of the work is in [ROADMAP.md](../ROADMAP.md).

## Vision

gen-agent is an open source generator of Spring AI agents. You describe an agent in an `agent.yaml` file or in a web
form, and you get a complete Spring Boot project, secure and ready to run. It is the JHipster approach, applied to
agents.

```bash
npx gen-agent new hr-assistant
gen-agent generate --from agent.yaml
```

**An honest promise**: an agent that is secure by default, observable and GDPR-aware, with documented limits. Not
"the perfect agent".

**Principles**

1. Generated code reads like code a good Spring developer wrote by hand.
2. Secure by default: good practices are on, and you turn them off explicitly.
3. One generation engine, shared by the CLI and the web generator.
4. Every generated project compiles and passes its tests, checked in CI.
5. Ship small and right before shipping big.

## Positioning

Related tools exist, but none combines a declarative agent file, a web generator and a Spring AI agent that is
secure by default.

| Project                | What it does                                                          | What it lacks compared to gen-agent     |
| ---------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| Trabuco                | Go CLI generating a Spring Boot project with a Spring AI agent module | No declarative agent file, no web UI    |
| generator-jhipster-llm | JHipster blueprint for LLM applications with Spring AI or LangChain4j | A plain LLM chat, no agent and no tools |
| agent-scaffold         | Generates agents from Markdown specs                                  | Python only, not Spring                 |
| spring-ai-agent-utils  | A library of agent tools for Spring AI                                | A library, not a generator              |

What sets gen-agent apart:

- an agent DSL (`agent.yaml`) with a JSON Schema, validation and editor completion, like JHipster's JDL;
- a web generator in the spirit of start.spring.io that builds the project in the browser;
- `minimal`, `standard` and `production` profiles that settle the trade-offs;
- security, GDPR and observability on by default;
- OpenAPI import, to turn an existing API into tools;
- gen-agent as an MCP server, so coding assistants can generate agents;
- incremental regeneration (`add tool`, `add mcp`, `update`).

## Profiles

Profiles decide how much the generated agent carries, so a prototype does not need Redis and Grafana.

| Building block                 | minimal   | standard | production                  |
| ------------------------------ | --------- | -------- | --------------------------- |
| ChatClient and system prompt   | yes       | yes      | yes                         |
| Conversation memory            | in memory | JDBC     | JDBC or Redis, with summary |
| Java and HTTP tools            | yes       | yes      | yes                         |
| MCP clients                    | no        | yes      | yes, isolated in containers |
| RAG (vector store)             | no        | option   | option                      |
| OAuth2 / OIDC authentication   | no        | yes      | yes                         |
| Rate limiting and token budget | no        | yes      | yes                         |
| Exact cache (Redis)            | no        | yes      | yes                         |
| Semantic cache                 | no        | no       | yes, per user               |
| PII masking                    | no        | no       | yes                         |
| Input and output guards        | no        | basic    | complete                    |
| OpenTelemetry and metrics      | no        | yes      | yes, with a Grafana board   |
| Evaluations in CI              | no        | no       | yes                         |
| Automated red teaming          | no        | no       | yes                         |
| GDPR erasure endpoint          | no        | no       | yes                         |
| Docker Compose                 | no        | yes      | yes, plus a Helm chart      |

## The agent.yaml file

`agent.yaml` is the heart of the project: the web generator writes it, the CLI reads it, and a single Zod schema
(exported as JSON Schema) validates it everywhere.

```yaml
agent:
  name: hr-assistant
  description: Internal HR assistant
  profile: production # minimal | standard | production
  java: 21
  build: maven # maven | gradle
  springAi: 2.0.1 # exact version, pinned in the templates

  model:
    provider: mistral # openai | anthropic | mistral | ollama
    name: mistral-large-latest
    temperature: 0.3
    maxTokens: 2000
    routing: # a small model for simple tasks
      strategy: rules
      simple: mistral-small-latest
      complex: mistral-large-latest
    fallback: # must also respect gdpr.euOnly
      provider: ollama
      name: llama3.1

  prompt:
    system: prompts/system.md # a versioned file, never hard-coded
    aiDisclosure: true # tell users they are talking to an AI

  memory:
    type: jdbc # in-memory | jdbc | redis
    window: 20
    summarize: true
    retention: 30d

  tools:
    - name: weather
      type: http
      url: https://api.open-meteo.com/v1/forecast
      cacheTtl: 10m
    - name: book-leave
      type: java
      approval:
        required: true
        expiresAfter: 24h # cancelled when nobody decides
  openapi:
    - spec: specs/hr-api.yaml
      include: [getLeaves, createLeave]

  mcp:
    - name: filesystem
      package: '@modelcontextprotocol/server-filesystem'
      version: 1.0.0 # exact version required, latest refused
      runtime: node
      sandbox: docker

  rag:
    enabled: true
    vectorStore: pgvector
    topK: 4
    rerank: true
    chunkSize: 500

  security:
    auth: oidc
    rateLimit: 30/min
    tokenBudget: 50000/day
    piiMasking: true
    injectionDetection: true

  cache:
    exact: redis
    semantic:
      threshold: 0.95
      scope: user # required: never a cache shared between users

  limits:
    maxIterations: 8
    timeout: 60s

  observability:
    otel: true
    metrics: prometheus
    grafanaDashboard: true
    feedback: true

  gdpr:
    euOnly: true # Mistral (EU) first, self-hosted Ollama as fallback
    erasureEndpoint: true
    logsWithoutPii: true

  evals:
    dataset: evals/golden.yaml
    redTeam: true
    ciModel: ollama # no paid calls in CI

  interface: [rest, chat-ui]
  deploy: [docker-compose, helm]
```

**Key validation rules**

- `cache.semantic.scope` cannot be `global`.
- A tool with a side effect (`POST`, `DELETE`) raises a warning when it has no `approval.required`.
- `gdpr.euOnly: true` refuses a provider outside the EU, in `fallback` and `routing` too, unless explicitly allowed.
- `mcp[].version` must be exact: `latest` and ranges are refused.
- `routing.strategy` is required as soon as `routing` is present.
- No API key is accepted in the file: only references to environment variables.

**Human approval**: `approval.required` generates a real flow. The tool call is held and stored, an endpoint approves
or rejects it, and the request expires after `expiresAfter`.

## Generator architecture

A TypeScript monorepo: one engine (`core`) produces the Java code, and both the CLI and the web generator use it.

```
gen-agent/
├── packages/
│   ├── core/         # Zod schema, validation, internal model, template rendering
│   ├── templates/    # templates of the generated Spring AI project
│   ├── openapi/      # OpenAPI spec to tools
│   ├── cli/          # npx gen-agent
│   ├── mcp-server/   # gen-agent as an MCP server
│   └── web/          # Next.js generator, zip built in the browser
├── e2e/              # generates reference projects, then builds and tests them
└── docs/             # guide and architecture decision records
```

| Need               | Choice                        | Why                                                   |
| ------------------ | ----------------------------- | ----------------------------------------------------- |
| Monorepo           | pnpm and Turborepo            | Incremental builds, shared packages                   |
| Schema             | Zod with a JSON Schema export | One source of truth for the web, the CLI and editors  |
| Templates          | EJS                           | Readable and proven                                   |
| Java formatting    | prettier-plugin-java          | The only Java formatter that also runs in the browser |
| CLI                | commander and @clack/prompts  | A polished interactive interface                      |
| Zip in the browser | JSZip                         | No server needed                                      |

**Generation flow**

1. Read `agent.yaml` (or the form answers).
2. Validate it with the Zod schema, with clear error messages.
3. Build a normalized internal model (profile applied, defaults filled in).
4. Select the templates of the enabled building blocks.
5. Render and format, then write to disk (CLI) or to a zip (web).
6. Write `.gen-agent.json` in the project, for `add` and `update`.

**Incremental regeneration** is the hardest problem of the project, so it was designed from the first version:
generated code lives in dedicated packages and base classes that user code extends without editing them, and
`.gen-agent.json` keeps the configuration and the hash of every generated file
([ADR 0001](adr/0001-separate-generated-and-user-code.md)). A conflict is reported, never overwritten silently.

**Tests**: unit tests of the schema and the model (Vitest), snapshots of the generated files, and end-to-end tests
that generate one reference project per profile and option family, then run `./mvnw verify` on each. Evaluations
and red teaming run on Ollama, so CI costs nothing.

## Security, costs, GDPR and monitoring

Each measure is an `agent.yaml` option, on by default in the `production` profile.

### Security

- OAuth2 / OIDC with Spring Security, and data strictly isolated per user.
- Per-user rate limiting (Bucket4j and Redis) and a daily token budget.
- Input size and format validation.
- Secrets in environment variables or a vault, never in the code or in `agent.yaml`.
- Prompt injection detection; RAG documents and tool results are treated as untrusted data.
- An agent that reads external content does not trigger a sensitive action on its own.
- Allow-listed tools, least privilege, human approval for destructive actions.
- Third-party MCP servers: pinned version, container, limited permissions.
- Kill switches per tool and for the whole agent.
- Reference: OWASP Top 10 for LLM applications.

### Tokens and costs

- Exact cache, then semantic cache, always per user.
- Stable content (system prompt, tool definitions) first, for provider prompt caching.
- Model routing: a small model for simple tasks, the large one only when needed.
- A sliding memory window and a summary of older messages.
- Precise RAG: few, short chunks, with reranking.
- Loop guards: maximum iterations, global timeout.

### Resilience

- Circuit breakers, retries with backoff and timeouts (Resilience4j).
- Fallback to another provider, then a fallback answer when none is available.

### GDPR

- Minimization: send the model only what it needs.
- PII masked before the model (emails, phone numbers, IBANs replaced by tokens, restored in the answer).
- An EU-hosted provider or a self-hosted model.
- Retention for memory, vectors, cache and logs, with automatic purge.
- Right to erasure: one endpoint that deletes the user everywhere.
- Users told they are talking to an AI (AI Act).

### Monitoring and quality

| Area        | What is measured                                         | Tool                             |
| ----------- | -------------------------------------------------------- | -------------------------------- |
| Traces      | Every model call and every tool call                     | OpenTelemetry through Micrometer |
| Metrics     | Tokens in and out, latency, cache hits, tool errors      | Prometheus and Grafana           |
| Quality     | Answers rated up or down, linked to traces               | User feedback                    |
| Regressions | A reference set replayed on every prompt or model change | Evaluations in CI                |
| Security    | Injection, rule bypass, system prompt extraction         | Automated red teaming in CI      |

Logs are structured and contain no personal data. Prompts are versioned like code.

## Known limits

| Limit                                      | Why                                             | Mitigation                                                         |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| Prompt injection cannot be fully prevented | Detection lowers the risk without removing it   | No sensitive action triggered alone after reading external content |
| PII masking is imperfect                   | Patterns miss cases (rare names, odd addresses) | Documented, data minimized upstream                                |
| A semantic cache can leak data             | Two close questions from two users              | Cache per user, no caching of answers with PII                     |
| Each guard adds latency                    | Several checks per request                      | Profiles, light checks                                             |
| LLMs are not deterministic                 | The same input can give different outputs       | Evaluations on a reference set rather than exact tests             |
| Third-party MCP servers are executed code  | Supply chain risk                               | Pinned version, container, limited permissions                     |
| Spring AI moves fast                       | APIs change between versions                    | Pinned versions, `update`, Renovate                                |

## Web generator

A Next.js static export that generates the project in the browser: no server, no API key, no cost. A form and a YAML
editor kept in sync, a live preview of the files, a zip download, YAML import and export, a gallery of examples, in
English and French.
