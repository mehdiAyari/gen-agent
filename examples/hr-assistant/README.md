# hr-assistant

> An agent with real business code: it books days off, and only after the employee approves.

![Sign-in with Keycloak, the days off left, a day off requested, approved in the chat page, then booked](demo.gif)

Employees sign in with Keycloak, ask how many days off they have left and book one. The booking goes through a Java
tool written by hand, on a table of its own, and waits for the approval of the employee in the chat page: the model
alone never books a day. Profile `standard` (OIDC, conversations in Postgres, limits per user, Docker Compose), on
[Ollama](https://ollama.com).

## How it was made

[`make.sh`](make.sh) runs these commands from an empty directory and writes [`app/`](app):

```bash
cat > agent.yaml << 'YAML'
agent:
  name: hr-assistant
  description: Tells employees how many days off they have left and books them
  profile: standard
  model:
    provider: ollama
    name: qwen2.5:7b
    temperature: 0
  interface: [rest, chat-ui]
YAML
gen-agent generate --from agent.yaml --output app

# Two tools, added to the generated project: the handlers are written by hand.
gen-agent add tool remaining-days-off --type java --dir app \
  --description "Days off the signed-in employee has left this year"
gen-agent add tool book-day-off --type java --dir app --approval --param date:string:required \
  --description "Books a day off for the signed-in employee, on a date written YYYY-MM-DD"
```

`generate` wrote the agent (sign-in, memory, limits, chat page, Compose with Postgres, Redis and Keycloak); each
`add tool` added a tool to `agent.yaml` and regenerated the project: the tool exposed to the model, its test, and a
handler for you to implement.

## What was written by hand

| File                                                                                                                             | Why                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`tool/DaysOff.java`](app/src/main/java/com/example/hrassistant/tool/DaysOff.java)                                               | The business rules: 25 days a year, working days to come only, each day once, per signed-in employee. |
| [`tool/DefaultRemainingDaysOffHandler.java`](app/src/main/java/com/example/hrassistant/tool/DefaultRemainingDaysOffHandler.java) | The generated handler, implemented: what the model reads.                                             |
| [`tool/DefaultBookDayOffHandler.java`](app/src/main/java/com/example/hrassistant/tool/DefaultBookDayOffHandler.java)             | The generated handler, implemented: runs once the employee approved the call.                         |
| [`db/migration/V100__day_off.sql`](app/src/main/resources/db/migration/V100__day_off.sql)                                        | The table of the days off, next to the migrations of gen-agent.                                       |
| [`prompts/system.md`](app/src/main/resources/prompts/system.md)                                                                  | What the assistant does, and that a booking waits for approval.                                       |
| [`DaysOffTests.java`](app/src/test/java/com/example/hrassistant/tool/DaysOffTests.java)                                          | The rules, tested against a real Postgres (Testcontainers).                                           |

The employee is the subject of the token: `DaysOff` reads it from Spring Security, so an employee never sees or books
the days of another. Everything else is generated, and `gen-agent update` never touches these files; the end-to-end
tests check it on every change.

## Run it

Java is not even needed, only Docker and Ollama:

```bash
OLLAMA_HOST=0.0.0.0 ollama serve &   # reachable from the containers
ollama pull qwen2.5:7b
cd app
docker compose up --build
```

Open <http://localhost:8080>, sign in as `demo` / `demo`, and ask:

- How many days off do I have left?
- Please book Friday 6 November 2026 off for me. (then Approve)

Or from a terminal:

```bash
TOKEN=$(curl -s localhost:8180/realms/agent/protocol/openid-connect/token \
  -d grant_type=password -d client_id=agent-client -d username=demo -d password=demo | jq -r .access_token)
curl -s localhost:8080/api/chat -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message": "How many days off do I have left?"}'
```

The answer holds the pending approvals; `POST /api/approvals/{id}` with `{"approved": true}` books the day.

## Test

```bash
cd app && ./mvnw verify   # 30 tests, Postgres and Redis in Docker, a fake model: no Ollama needed
```

## Limits

- On a laptop CPU, `qwen2.5:7b` takes about a minute per answer. `qwen2.5:3b` is faster but often skips the tools.
- The model works out the date from the message: ask with the full date, it has no calendar.
- The approval card shows the raw arguments of the call (`{"date":"2026-11-06"}`).
