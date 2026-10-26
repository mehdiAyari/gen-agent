# V5d — Quality and operations

Part of the `production` profile plan (`2026-10-24-v5-production-profile.md`, decisions G, H, I, L). Validated on 2026-10-26. Tested down to `./mvnw verify` (and `helm lint`), tried for real with Ollama, and committed.

## Decisions

|     | Decision                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | `evals.dataset` (default `evals/golden.yaml`, yours): cases with a question, `mustContain` / `mustNotContain` checked in Java, and a free `criterion` judged yes or no by the model; a global `threshold` (0.8 by default).                                            |
| Q2  | `evals.redTeam`: built-in attacks in English and French (system prompt extraction, role play, encoded and indirect requests, forced words); an attack succeeds when the answer repeats a line of the system prompt or says the forced word.                            |
| Q3  | `./mvnw verify -Pevals` runs both on Ollama (`evals.ciModel`), the model of the agent when it runs on Ollama, else `qwen2.5:3b` (`EVALS_MODEL`; `qwen2.5:1.5b` judges at random); the report goes to `target/evals-report.md`. Normal `./mvnw verify` never runs them. |
| Q4  | A generated `.github/workflows/ci.yml`: `./mvnw verify`, then the evaluations with Ollama installed in the job and its models cached between runs.                                                                                                                     |
| Q5  | `observability.grafanaDashboard`: an agent dashboard (requests, model calls and tokens by model, tool calls, guard refusals, circuit breakers) provisioned into `otel-lgtm` by Compose.                                                                                |
| Q6  | `deploy: [helm]`: a chart in `helm/<name>/` with the image, secrets by reference (`existingSecret`), external Postgres and Redis, an optional ingress, liveness and readiness probes on the management port.                                                           |
| Q7  | `production` adds the evaluations (`evals/golden.yaml`, red team, Ollama), the dashboard (with OpenTelemetry) and the Helm chart.                                                                                                                                      |
