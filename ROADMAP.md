# Roadmap

A version is released only when all its end-to-end tests pass. Each version adds one block.

## V1 — The foundation ✅

- [x] pnpm + Turborepo monorepo, CI, quality tooling (ESLint, Prettier, knip, lefthook, commitlint), Renovate
- [x] `agent.yaml` Zod schema, cross-field rules, JSON Schema export
- [x] `minimal` profile templates on Spring AI 2.0.1: ChatClient, system prompt file, memory, Java and HTTP tools, REST endpoint
- [x] Separation of generated and user code, `.gen-agent.json` (prepares `add` and `upgrade`)
- [x] CLI `gen-agent new` (interactive) and `gen-agent generate`
- [x] End-to-end tests: generated projects compile and pass `./mvnw verify`
- [x] Demo GIF (local model, real tool call)
- [x] Single `gen-agent` npm package, tested from its packed tarball
- [ ] npm publication, release

## V2 — The showcase ✅

- [x] Next.js web UI on the `minimal` profile, generating the zip in the browser (English and French, dark mode)
- [x] Examples gallery (customer support, HR assistant, DevOps agent, weather agent)
- [x] Playwright tests: zip identical to the CLI output and passing `./mvnw verify`, accessibility checked with axe

## V3 — Flagship features ✅

- [x] HTTP tools with path, query and body parameters, URL templates, bearer or API key authentication from
      environment variables, bounded responses
- [x] OpenAPI 3 import into tools: `gen-agent import openapi`, `openapi:` in agent.yaml, and in the web generator
- [x] gen-agent as an MCP server: `gen-agent mcp`

## V4 — `standard` profile ✅

- [x] V4a: JDBC memory (Postgres), OIDC authentication with conversations bound to their user, request and token
      limits per user (Bucket4j + Redis), Dockerfile and Docker Compose (Postgres, Redis, Keycloak), profile in the web
      generator
- [x] V4b: exact cache (Redis, per user, not for answers built from a tool), OpenTelemetry traces and metrics with
      Grafana in Docker Compose and a Prometheus endpoint, MCP clients (npx, uvx or a Docker container)
- [x] V4c: chat page (sign-in with the authorization code and PKCE, strict content security policy),
      `gen-agent add tool`, `gen-agent add mcp` and `gen-agent update`, which keep the user's changes

## V5 — `production` profile ✅

- [x] V5a: PII masking before the model and in the logs (with a correlation id), erasure endpoints (`DELETE /api/me`,
      admin `DELETE /api/users/{id}`), retention with an hourly purge, semantic cache per user (pgvector)
- [x] V5b1: prompt injection detection (English and French, base64 too), untrusted tool results, output guardrails,
      tool call and request time limits
- [x] V5b2: retries and circuit breaker, fallback provider then fallback answer, model routing, conversation summaries
- [x] V5b3: human approval of tool calls (Postgres, chat page buttons), kill switches (Redis, admin endpoints)
- [x] V5c: RAG in pgvector (documents folder and admin uploads, Apache Tika, reranking by the model), documents treated
      as untrusted data
- [x] V5d: evaluations and red teaming on Ollama, generated CI workflow, Grafana dashboard, Helm chart

## Later

- [ ] `gen-agent upgrade`, plugins, multi-agents and A2A, scheduled agents, multimodal, "describe your agent", Helm chart
