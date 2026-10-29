# gen-agent — instructions for coding agents

gen-agent generates Spring AI agents from an `agent.yaml` file, in the spirit of JHipster. The design is in
[`docs/specification.md`](docs/specification.md), the format reference in [`docs/guide.md`](docs/guide.md), the
contribution rules in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Settled decisions

- Templates in **EJS**; generated Java formatted by **prettier-plugin-java** only (it also runs in the browser, so the
  CLI and the web generator produce identical code). No Spotless in generated projects.
- Generated projects: **Java 21**, Maven or Gradle, **Spring Boot 4.1.1** and **Spring AI 2.0.1**, pinned.
- Generated code and user code are strictly separated, and `.gen-agent.json` keeps the configuration and the hash of
  every generated file: see [ADR 0001](docs/adr/0001-separate-generated-and-user-code.md).
- No API key is ever accepted in `agent.yaml`: only references to environment variables.
- The schema accepts the whole format; what a version cannot generate yet is refused by `unsupportedFeatures` with a
  clear message, never ignored.
- One dependency list (`packages/core/src/dependencies.ts`) feeds both `pom.xml` and `build.gradle.kts`.
- Code, comments and documentation in **English**. The web generator is translated into English and French.
- No code is taken from other generators, not even as a dependency.

## The golden rule

Generated Java must read like code a good Spring developer wrote by hand: constructor injection, records for DTOs,
`@ConfigurationProperties`, sorted imports, no dead code. Details: [`docs/template-authoring.md`](docs/template-authoring.md).

## Way of working

1. Plan first (`docs/plans/`), and have it validated before coding.
2. Small steps, each with green tests (the test fails first), in **Conventional Commits**.
3. Stop and ask as soon as a choice is not covered by the specification.
4. Before a commit: `pnpm lint`, `pnpm typecheck`, `pnpm test`; for template changes, the end-to-end tests too.

## Skills

Optional public agent skills that fit the project, pinned in `skills-lock.json`: `spring-boot-skill`
(sivaprasadreddy/sivalabs-agent-skills), `frontend-design` (anthropics/skills), `vercel-react-best-practices`,
`web-design-guidelines` (vercel-labs/agent-skills) and `shadcn` (shadcn-ui/ui). Where a skill and this file disagree,
this file wins:

- `spring-boot-skill` organizes code by business module; here the `…generated` package separation comes first, then
  features inside it. Its Spotless, JaCoCo and git-commit-id plugins are not generated.
- DTOs keep `*Request` / `*Response` names, but never `ChatResponse` (it collides with Spring AI): `ChatMessageResponse`.
- Kept from the skill: Jackson 3 (`tools.jackson`), `ProblemDetail` in a `@RestControllerAdvice`, `@Valid`,
  controllers that delegate to a service, slice tests (`@WebMvcTest`, `@RestClientTest`).
- Web generator: colors only through the shadcn theme variables; sentence case everywhere; static export, so the
  server-side rules of `vercel-react-best-practices` do not apply.

## Known pitfalls

- Spring AI 2.0.1 ignores inherited `@Tool` methods: Java tools are wired by composition.
- Tools are executed by `ToolCallingAdvisor` inside `ChatClient`, not by the model; tool call limits are
  `spring.ai.tools.limits`.
- A model casts the prompt options to its own class: always start from `chatModel.getOptions().mutate()`.
- The JDBC chat memory limits `conversation_id` to 36 characters (the key is a name-based UUID of user and
  conversation) and reads messages back by `sequence_id`.
- Spring AI's Redis chat memory needs RedisJSON and the query engine, which the official Redis 8 images lack: the
  generated Redis memory is a plain list repository, and the semantic cache lives in pgvector.
- Small models drop the brackets of PII tokens (`IBAN_1`): tokens are restored with or without brackets. Arguments
  chosen by a model are untrusted.
- Remote MCP tokens go through a `McpClientCustomizer` that sets the header on the base request builder (copied for
  each request).
- EJS must be called without `filename` (otherwise `fs.existsSync` runs in the browser), and template variables must not
  shadow EJS's own names (`imports`).
- `@gen-agent/web#typecheck` depends on its `build`: `next build` and `next typegen` both write to `.next/`.
- Ollama must listen on `0.0.0.0` to be reached from Docker Compose. With an old Compose plugin and a recent Docker,
  set `DOCKER_API_VERSION`.

## Environment

Node 22 LTS, pnpm (through corepack), JDK 21. Docker for the end-to-end tests that start Compose; Ollama with
`qwen2.5:3b` and `nomic-embed-text` for the live tests and the evaluations; Helm for `helm lint`.
