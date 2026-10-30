# petstore-assistant

> An existing API becomes an agent: two commands, no Java written.

![The Petstore spec imported, the project generated, the agent answering from the live API](demo.gif)

The public [Swagger Petstore](https://petstore3.swagger.io) API, imported from its OpenAPI spec: the agent finds pets by
status and by id, calling the live API. Profile `minimal`, on [Ollama](https://ollama.com): no API key, no cost.

## How it was made

[`make.sh`](make.sh) runs these commands from an empty directory and writes [`app/`](app):

```bash
cat > agent.yaml << 'YAML'
agent:
  name: petstore-assistant
  description: Helps the customers of the pet store find a pet
  model:
    provider: ollama
    name: qwen2.5:7b
    temperature: 0
YAML
gen-agent import openapi https://petstore3.swagger.io/api/v3/openapi.json \
  --base-url https://petstore3.swagger.io/api/v3 --no-auth --include findPetsByStatus,getPetById
gen-agent generate --from agent.yaml --output app
```

`import openapi` saved the spec in `specs/petstore.json` and listed the two operations in `agent.yaml`; `generate` turned
them into HTTP tools, each with its test, and copied `agent.yaml` and the spec into the project.

## What was written by hand

One file, and it is not Java:

| File                                                                               | Why                                                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`src/main/resources/prompts/system.md`](app/src/main/resources/prompts/system.md) | The generated prompt is generic. This one names the tools, says how to list pets, and forbids anything the API did not return. |

Run `./make.sh /tmp/petstore && diff -r /tmp/petstore app` to see it: the prompt is the only difference. The end-to-end
tests check it on every change.

## Run it

Java 21 and Ollama:

```bash
ollama pull qwen2.5:7b
cd app
./mvnw spring-boot:run
```

The spec declares OAuth 2 and an API key that the public Petstore does not enforce: `--no-auth` imports the tools
without them. For an API that needs them, leave it out: gen-agent reads the token from the environment and never writes
it in `agent.yaml`.

## Try it

```bash
ask() { curl -s localhost:8080/api/chat -H 'Content-Type: application/json' \
  -d "{\"conversationId\": \"demo\", \"message\": \"$1\"}" | jq -r .reply; }
ask "Which pets are available right now?"
ask "Tell me about the pet with id 10."
ask "Quels animaux ont déjà été vendus ?"
```

## Limits

- The Petstore is a public sandbox: anyone adds pets to it, so the names are test data and change every day.
- On a laptop CPU, `qwen2.5:7b` takes from 20 seconds to a few minutes per answer (the longer the list it reads, the
  slower). `qwen2.5:3b` is faster but invents details (a status, a count) the API did not return.
- A question the model reads differently gets another search: in French, "vendus" (sold) is clear, "en vente" means for
  sale.

## Another provider

Change `model` in `app/agent.yaml` (for instance `provider: mistral` and `name: mistral-small-latest`), then run
`gen-agent update` in `app/`: the starter, the configuration and the README follow, and the prompt stays yours. Set
the API key of the provider (`MISTRAL_API_KEY`) instead of pulling a model.
