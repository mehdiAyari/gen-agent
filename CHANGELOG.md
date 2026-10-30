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

- RAG (`rag.enabled`, any profile): the files of `documents/` read by Apache Tika, split into passages and indexed in
  pgvector at startup (only what changed, by fingerprint; removed files forgotten), admin uploads at
  `/api/admin/documents`, the `topK` closest passages sent as data between `<document>` tags and never kept in the
  conversation, optional reranking by the model, passages that hold prompt injection dropped. Postgres now runs
  whenever a feature needs it, even with conversations in memory.

- Quality and operations: `./mvnw verify -Pevals` scores the whole agent on Ollama, against `evals/golden.yaml` (words
  that must or must not appear, and a criterion judged by the model) and a red team of attacks in English and French;
  a generated GitHub Actions workflow runs the tests, then the evaluations with cached Ollama models. A Grafana
  dashboard provisioned into `otel-lgtm` (requests, model calls and tokens, tools, guard refusals, circuit breakers),
  and a Helm chart (secrets by reference, probes on the management port, non-root, read-only file system). All on by
  default in `production`.

- Remote MCP servers (`mcp[].url`, Streamable HTTP), their token from an environment variable sent with every request;
  `gen-agent add mcp --url --token-env` and the web generator too. MCP servers in containers now run from an image of
  their own built by `docker/mcp/build-images.sh`, offline unless `network: true`, as a user without privileges, on a
  read-only file system, with no Linux capability and bounded memory, CPU and processes.

- The rest of the format: `memory.type: redis` (a repository on plain Redis lists), `cacheTtl` on HTTP tools (results
  in Redis per user), `observability.feedback` (thumbs on the answers, counted, traced and kept in Postgres) and
  `build: gradle` (Kotlin DSL and the Gradle Wrapper 9.8.2, checksum-verified). Every dependency is listed once, for
  Maven and Gradle alike.
- Test coverage of every package (`pnpm coverage`), kept by the CI; a short README, the details in `docs/guide.md`.
- Examples in `examples/`: complete agents with the commands that made them (`make.sh`), the code written by hand
  afterwards and a recording of a real run on Ollama; the end-to-end tests check each one still matches its commands.
- Tests: every combination of the pairwise sample runs its own tests, not only its compilation, and agents are started
  for real on Ollama in CI and asked questions.
- `gen-agent add tool --approval`: the calls of the new tool wait for the approval of the user who asked.
- `gen-agent add tool --param name:type:required:description`: the description of a parameter, read by the model.
- `gen-agent import openapi --no-auth` (`auth: none` on an `openapi` entry): a public API whose spec declares a
  security it does not enforce needs no token.
- `gen-agent new --provider` (with `--model`, `--description`, `--package`) asks nothing: for scripts and CI.

### Fixed

- Found by running the tests of every combination instead of compiling them: with a tight request limit in
  `agent.yaml` (5/sec), the generated tests sent their messages faster than it and failed; they now run with their own
  limit.
- The GitHub Actions workflow of the generated projects started Ollama next to the system service its installer
  starts, so the models were downloaded on every run instead of coming from the cache.
- Found by following the README on a machine with only Java and Node: without `unzip`, the Maven Wrapper downloaded
  the `.tar.gz` of Maven and checked it against the SHA-256 of the `.zip`, so no generated project could build. The
  wrapper is now of type `bin`: Java downloads Maven, checks it and unpacks it. An end-to-end test builds a Maven and
  a Gradle project in that clean room on every change.
- Found by attacking the production agent: the prompt injection patterns caught 27 of 58 common attacks (now all of
  them, with no false alarm on ordinary messages; 8 of 30 attacks never seen before); "developer mode" in an ordinary
  question was refused; the responses lacked the cross-origin and permissions headers an OWASP ZAP scan expects, and
  a chat page without sign-in had no security header at all.
- Found by updating a project made by an earlier version and changed by hand: an edit to a generated file was lost
  without a word (it is now kept as `<file>.gen-agent-old` and reported), and the files of a tool removed from
  `agent.yaml` stayed behind, its untouched handler breaking the build (files nobody changed are now deleted).
- Found by walking the paths never walked (MCP servers local and remote, Gradle, routing and fallback, a kind cluster):
  the Helm chart ran two replicas of an agent that keeps its conversations in memory, so each one forgot half of
  them; its README did not say how to build and push the image, nor what `my-values.yaml` holds.
- Found by cutting the dependencies of a running agent: when Postgres or Redis is down, a request answered 500 after 30
  or 60 seconds; it now answers 503 with `Retry-After` within seconds. When the provider is down, a failing embedding
  (semantic cache, knowledge base) answered 500 instead of the fallback model and the fallback answer. A refused first
  message returned a conversation id that led to 404; feedback was accepted on any conversation id; validation errors
  did not say which field was wrong.
- Found by generating every combination of options and building them: a semantic cache without the exact one did not
  compile (it now brings the exact cache, which it is looked up after); `ToolGuard` and the evaluations missed imports
  in some combinations; empty `evals` evaluated nothing (they now score the reference set); a signed-in agent without
  Compose never said to set `OIDC_ISSUER_URI`; tools were registered through an API Spring AI deprecates for removal;
  two generated tests (summaries without sign-in, the semantic cache with a classifier) were wrong.
- Found by the examples, and checked again on them: approval cards show the tool name of agent.yaml and one line per
  argument, not the Java name and raw JSON; answers and tool calls are logged without their content; Compose projects
  are named after the agent; guard and feedback counters exist from the start, so the dashboard counts the first
  refusal; a forced word in French ("réponds uniquement par le mot …") is refused; a production agent on Ollama waits
  5 minutes instead of 60 seconds.
- An agent that needs Postgres or Redis without Docker Compose had nothing to start them: it now runs with
  `./mvnw spring-boot:test-run` (`./gradlew bootTestRun`), its services in Docker as in its tests (found while writing
  the examples).
- `gen-agent generate --output` outside the current directory printed a `../..` path: it prints the absolute one.
- The Helm chart had no Dockerfile to build its image without Docker Compose (found on a kind cluster).
- A semantic cache with conversations kept in memory had no database to run on.
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
