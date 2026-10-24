# V5 — `production` profile

Validated on 2026-10-24. Four deliveries, each tested down to `./mvnw verify` against real containers, tried
for real with a local model, and committed.

| Delivery                        | Content                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V5a — Personal data             | PII masking before the model, logs without PII with a correlation id, erasure endpoints, retention with automatic purge, semantic cache per user                              |
| V5b — Robustness and guardrails | Prompt injection detection, output guardrails, loop limits, retries and circuit breaker, fallback provider then fallback answer, model routing, human approval, kill switches |
| V5c — RAG                       | Documents indexed in pgvector, retrieval before each answer, documents treated as untrusted data                                                                              |
| V5d — Quality and operations    | Evaluations on a reference set, automated red teaming, generated CI workflow on Ollama, Grafana dashboard, Helm chart                                                         |

## Decisions

|     | Decision                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | PII masking with patterns (emails, phones, IBAN, Luhn-checked card numbers, French social security numbers): values become tokens before the model and come back in the reply and in tool arguments. Names are not detected: a documented limit.         |
| B   | Semantic cache per user, threshold from agent.yaml; never for answers built from a tool or holding personal data. Changed during V5a: in pgvector (Postgres), since the official Redis 8 images ship without the search module that vector search needs. |
| C   | `DELETE /api/me` erases the user's own data; `DELETE /api/users/{id}` for the `agent-admin` role.                                                                                                                                                        |
| D   | Prompt injection: heuristic rules (English and French), tool results and RAG documents delimited as untrusted. No extra model call by default.                                                                                                           |
| E   | Human approval: the tool call waits in Postgres; the user confirms with `POST /api/approvals/{id}` before `expiresAfter`.                                                                                                                                |
| F   | Routing: `strategy: rules` and `strategy: classifier`.                                                                                                                                                                                                   |
| G   | Evaluations from `evals/golden.yaml` and red teaming with a canary in the system prompt, run by `./mvnw verify -Pevals` against Ollama; a generated GitHub Actions workflow runs them.                                                                   |
| H   | Helm chart: image, secrets by reference, external Postgres and Redis, probes on the management port.                                                                                                                                                     |
| I   | Grafana dashboard provisioned in `otel-lgtm`.                                                                                                                                                                                                            |
| J   | Resilience4j if compatible with Spring Boot 4, else Spring Framework 7 retry and a simple circuit breaker.                                                                                                                                               |
| K   | Kill switches as Redis flags, applied at once, with an admin endpoint.                                                                                                                                                                                   |
| L   | `production` turns everything on; retention 30d, `maxIterations: 8`, `timeout: 60s`, semantic threshold 0.95.                                                                                                                                            |
