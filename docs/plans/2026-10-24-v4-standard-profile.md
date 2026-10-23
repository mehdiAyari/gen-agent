# V4 — `standard` profile

Validated on 2026-10-24. Three deliveries, each tested down to `./mvnw verify` and committed.

| Delivery      | Content                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V4a — Secure  | JDBC memory (Postgres), OIDC (Spring Security resource server), conversations bound to their user, rate limit and daily token budget (Bucket4j + Redis), Docker Compose (agent, Postgres, Redis, Keycloak) |
| V4b — Operate | Exact cache (Redis), OpenTelemetry and Prometheus metrics (Grafana through `otel-lgtm` in Compose), MCP clients                                                                                            |
| V4c — Use     | Chat UI, `gen-agent add tool`, `gen-agent add mcp`                                                                                                                                                         |

## Decisions

|     | Decision                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Generated tests use Testcontainers (real Postgres, Redis): Docker is required to test a `standard` project, not a `minimal` one.                                                                              |
| B   | The agent is an OIDC resource server: it validates JWTs from the issuer in `OIDC_ISSUER_URI`. Compose ships a test Keycloak with a `demo` user. Browser login comes with the chat UI (V4c).                   |
| C   | A conversation belongs to the user of the token: another user's conversation answers 404.                                                                                                                     |
| D   | Daily token budget per user, counted from the usage the model reports, kept in Redis; 429 with the reset time once used.                                                                                      |
| E   | Exact cache (V4b): first message of a conversation only; key = user + model + system prompt + normalized message; never shared between users.                                                                 |
| F   | MCP (V4b): `sandbox: none` runs the server directly; `sandbox: docker` through `docker run` with a pinned version. Full isolation policy in V5.                                                               |
| G   | A generated multi-stage Dockerfile, non-root user (no buildpacks).                                                                                                                                            |
| H   | `add` (V4c) regenerates: `generated` files rewritten, `user` files never touched, `merged` files rewritten only when unchanged since generation (fingerprint), else written next to them as `.gen-agent-new`. |
| I   | Web form: profile choice and its options once each delivery works in the CLI and Maven.                                                                                                                       |
| J   | Every dependency and image checked on Maven Central / the registry before use, and pinned.                                                                                                                    |
