# Finishing the format, live tests and the showcase

Scope (2026-10-29): fix what is inconsistent, generate what the format still refuses, try for real what was
only built, and prepare the repository for publication.

## Decisions

|     | Decision                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | `memory.type: redis`: a hand-written `ChatMemoryRepository` on plain Redis lists. Spring AI's Redis repository needs RedisJSON and the Redis Query Engine, which the official Redis 8 images do not ship. Erasure, retention and approvals still need `jdbc`.                             |
| F2  | `tools[].cacheTtl` (HTTP tools): results cached in Redis per user, tool and arguments, for `cacheTtl`.                                                                                                                                                                                    |
| F3  | `observability.feedback`: `POST /api/feedback` (conversation, up or down, optional comment) counts `agent.feedback` by rating, adds an event to the trace, and keeps a row in Postgres (`agent_feedback`) to read the answers rated down; buttons in the chat page; erased with the user. |
| F4  | `build: gradle`: `build.gradle.kts`, `settings.gradle.kts` and the Gradle Wrapper (checksum-verified), one reference agent built with Gradle in the end-to-end tests.                                                                                                                     |
| F5  | Tried for real: RAG with a PDF and admin uploads, an isolated Node MCP server, the Helm chart on a local Kubernetes cluster (kind). The generated CI workflow and the other providers need GitHub and API keys: left to the maintainer.                                                   |
| F6  | Showcase: a short README that hooks in 30 seconds, test coverage measured in CI. Publishing (GitHub, npm, SonarCloud) needs the maintainer accounts.                                                                                                                                      |
