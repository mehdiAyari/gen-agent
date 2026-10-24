# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org).

## [0.1.0] — unreleased

### Added

- `agent.yaml` schema covering the whole specification, with errors located by line, secret detection, EU-only providers,
  exact MCP versions and warnings for tools with side effects; JSON Schema for editors.
- `minimal` profile: Spring Boot 4.1.1, Spring AI 2.0.1, Java 21, Maven Wrapper; chat client with a system prompt file and
  windowed memory, `POST /api/chat`, HTTP tools (RestClient) and Java tools (handler you implement), AI disclosure flag.
- Generated tests with a fake model: the generated project passes `./mvnw verify` without calling a provider.
- `.gen-agent.json`: configuration, owner and fingerprint of every generated file.
- CLI: `gen-agent new` (interactive) and `gen-agent generate --from agent.yaml`, published as one bundled package.
- Errors of the chat endpoint answered as problem details, internal details kept in the logs.
- Web generator (`packages/web`): form and `agent.yaml` editor kept in sync, live preview of the generated files with
  their owner, examples gallery, zip download, `agent.yaml` import and export; runs entirely in the browser.

- HTTP tools: `in: path | query | body`, `{name}` placeholders in the URL, `apiName` for parameters named
  differently in the API, `auth` (bearer token or API key header, from an environment variable) and
  `maxResponseChars`. The generated README and the CLI list every environment variable to set.
- OpenAPI 3.0 and 3.1 import (`packages/openapi`): `gen-agent import openapi <file|https url>` with `--include`,
  `--expand` and `--base-url`; `openapi:` entries in agent.yaml resolved by `generate`; "Import from OpenAPI" in the
  web generator. Operations a tool cannot send are skipped with the reason.
- `gen-agent mcp`: validate, preview, import and generate from a coding assistant (`packages/mcp-server`).

- `standard` profile: conversations in Postgres (Spring AI JDBC memory), OIDC resource server, conversations bound to
  the user of the token, request rate and token budget per user (Bucket4j + Redis, 429 with `Retry-After`),
  Dockerfile and `compose.yaml` with Postgres, Redis and a Keycloak test realm. Its tests run against real containers
  (Testcontainers). Every piece can be set on its own in agent.yaml and in the web generator.
- Exact cache of first answers (Redis, per user, never for answers that called a tool), OpenTelemetry traces and
  metrics (Grafana through `otel-lgtm` in Compose) and a Prometheus endpoint on the management port, MCP servers
  (`npx`, `uvx` or a throwaway Docker container, with `args` and the names of the variables they get).
- Chat page (`interface: [rest, chat-ui]`): plain HTML, CSS and JavaScript served by the agent; with OIDC, users sign
  in from the browser (authorization code with PKCE) and the API stays stateless.
- `gen-agent add tool`, `gen-agent add mcp` and `gen-agent update`: generated files rewritten, user files kept, shared
  files rewritten only when unchanged since generation (fingerprints of `.gen-agent.json`), else written next to them
  as `.gen-agent-new`. `generate` keeps agent.yaml and its specs in the project.

- `production` profile, personal data: emails, phone numbers, IBANs, Luhn-checked card numbers and French social
  security numbers replaced by tokens before the model and put back in the answer and in tool arguments (values kept
  in Redis), masked in the logs and stack traces with a correlation id per request, `DELETE /api/me` and
  `DELETE /api/users/{id}` (role `agent-admin`) erasing conversations, personal data, cache and limits, retention of
  conversations with an hourly purge (Flyway table `agent_conversation`), and a semantic cache per user in pgvector
  that never keeps an answer built from a tool or holding personal data. In the web generator too.
- Guardrails (`production`, or one by one): prompt injection detection on messages and tool results (English and
  French, plainly or in base64) answered with a refusal without calling the model; tool results marked as untrusted
  data, and only read-only tools left once one held instructions; answers that repeat the system prompt refused and API
  keys masked (`security.outputGuard`); `limits.maxIterations` through Spring AI's tool call limits (422) and
  `limits.timeout` interrupting the whole request (504).
- Resilience: retries tuned per provider, a Resilience4j circuit breaker per model, `model.fallback` (another model or
  another provider, built by hand so that one `ChatModel` bean remains) then a fallback answer instead of an error;
  `model.routing` by rules or by a classifier; `memory.summarize` keeping a summary of older messages. The README and
  the CLI list every Ollama model to pull.

- Human control: `tools[].approval` keeps each call in Postgres until the user who asked approves or denies it
  (`GET /api/approvals`, `POST /api/approvals/{id}`, buttons in the chat page), then tells the model; calls expire
  after `expiresAfter` (24h by default). `security.killSwitches` (on in `production`) lets the `agent-admin` role
  switch the agent (503) or each tool off at once, through flags in Redis.

### Fixed

- An empty answer of the model is never cached.
- `gdpr.erasureEndpoint` needs `memory.type: jdbc` (conversations are found per user in Postgres); `production` only
  turns it on then.

### Security

- Tool arguments from the model are treated as untrusted: boxed types and explicit checks of required arguments, whose
  message goes back to the model instead of failing the request (found by running a generated agent on a real model).
- Maven Wrapper pins Maven 3.9.16 and checks the SHA-256 of the download.
- Path values from the model are encoded, so a tool argument cannot change the path it calls (`../admin`); tested in
  every generated project.
- Tool credentials never appear in agent.yaml or in the generated code: only environment variable names.
- `gen-agent mcp` reads and writes only inside the assistant's workspace, never overwriting a file.
- `standard` agents: no request without a valid token, a user cannot read or continue another user's conversation
  (404), and limits per user keep anyone from exhausting the agent or its bill.
- The chat page shows replies as text, never as HTML, under a content security policy that only allows the agent and
  its identity provider.
