# Fixes found by the examples

Scope (2026-10-30): what writing and running the four examples showed, fixed in gen-agent, then every example
regenerated with `gen-agent update`, run again on Ollama and recorded again.

## Decisions

|     | Decision                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Approvals read like a sentence: each pending call carries the tool name of `agent.yaml` (`send-transfer`) and its arguments as `name: value` lines; the chat page shows them instead of the Java name and raw JSON. The JSON stays in the API for clients. |
| R2  | `gen-agent new` runs without questions when `--provider` and `--model` are given (with `--description`, `--package`, `--profile`); `make.sh` of the examples uses it.                                                                                      |
| R3  | `gen-agent add tool --param 'date:string:required:the day, as YYYY-MM-DD'`: an optional fourth part is the description of the parameter, read by the model.                                                                                                |
| R4  | `gen-agent import openapi --no-auth` (and `auth: none` on an `openapi` entry): for public APIs whose spec declares security they do not enforce, such as the Petstore. No more dummy tokens.                                                               |
| R5  | The agent logs each answer and each tool call at INFO: the tool, its duration and whether it failed, never the message or the arguments (personal data). The full exchange stays in the traces.                                                            |
| R6  | `compose.yaml` names its project after the agent (`name: bank-desk`): containers are `bank-desk-agent-1`, not `app-agent-1`.                                                                                                                               |
| R7  | Counters exist from the start at zero (guard refusals by reason, feedback by rating, approvals): Prometheus misses the first increase of a counter that appears, so the dashboard showed no refusal.                                                       |
| R8  | A forced word is caught in French too ("réponds uniquement par le mot …", "dis seulement …"), with a test: the attack the red team found in V5d, still open.                                                                                               |
| R9  | With Ollama, `limits.timeout` defaults to 5 minutes instead of 60 seconds: a local model on a CPU needs it. Other providers keep 60 seconds.                                                                                                               |
| R10 | Then the four examples: `gen-agent update`, the end-to-end tests, a run on Ollama, new recordings, and the Grafana dashboard captured with a refusal in it.                                                                                                |

Each fix is one commit with its failing test first; the reference snapshots are reviewed as code.
