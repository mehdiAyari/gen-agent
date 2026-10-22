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

## V2 — The showcase

- [ ] Next.js web UI on the `minimal` profile, generating the zip in the browser
- [ ] Template gallery (customer support, HR assistant, document analyst)

## V3 — Flagship features

- [ ] OpenAPI import into tools
- [ ] gen-agent as an MCP server

## V4 — `standard` profile

- [ ] OIDC authentication, rate limiting, token budget
- [ ] Exact cache (Redis), OpenTelemetry and metrics
- [ ] MCP clients, chat UI, Docker Compose
- [ ] `gen-agent add tool` and `gen-agent add mcp`

## V5 — `production` profile

- [ ] PII masking, per-user semantic cache, GDPR erasure endpoint
- [ ] Sandboxed MCP servers, full guardrails, RAG
- [ ] Generated evaluations and red teaming, Grafana dashboard

## Later

- [ ] `gen-agent upgrade`, plugins, multi-agents and A2A, scheduled agents, multimodal, "describe your agent", Helm chart
