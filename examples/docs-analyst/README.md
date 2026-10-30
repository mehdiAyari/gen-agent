# docs-analyst

> Answers from your documents, says when they do not know, and is scored on every change.

![The handbook indexed, questions answered from Markdown and PDF, one the handbook does not answer, then the evaluations](demo.gif)

The employee handbook of Fjord Labs, a fictional company, in Markdown and PDF: the agent answers from it with the
exact figures, names the page, and says when the handbook does not say. A reference set of questions scores it on
Ollama. Profile `minimal` with RAG (pgvector, reranking by the model): no sign-in, no Compose.

## How it was made

[`make.sh`](make.sh) runs these commands from an empty directory and writes [`app/`](app):

```bash
cat > agent.yaml << 'YAML'
agent:
  name: docs-analyst
  description: Answers the questions of employees from the handbook of the company
  model:
    provider: ollama
    name: qwen2.5:7b
    temperature: 0
  rag:
    enabled: true
    rerank: true
  evals:
    dataset: evals/golden.yaml
YAML
gen-agent generate --from agent.yaml --output app
```

`generate` wrote the knowledge base (documents read by Apache Tika, split, embedded with `nomic-embed-text` and kept
in pgvector, indexed again only when they change), the evaluations and a CI workflow that runs them on Ollama.

## What was written by hand

| File                                                            | Why                                                                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`documents/`](app/documents)                                   | The handbook: three Markdown pages and a PDF, all invented for this example.                               |
| [`evals/golden.yaml`](app/evals/golden.yaml)                    | Six questions employees ask, with the words a good answer holds and what it must do; one it cannot answer. |
| [`prompts/system.md`](app/src/main/resources/prompts/system.md) | Answer only from the handbook, give the exact figures and the page, say when the handbook does not say.    |

No Java: the knowledge base and the evaluations are generated.

## Run it

Java 21, Docker and Ollama:

```bash
ollama pull qwen2.5:7b && ollama pull nomic-embed-text
cd app
./mvnw spring-boot:test-run   # Postgres with pgvector starts in Docker, as in the tests
```

The documents of `documents/` are indexed at startup. Then:

```bash
ask() { curl -s localhost:8080/api/chat -H 'Content-Type: application/json' \
  -d "{\"message\": \"$1\"}" | jq -r .reply; }
ask "How many days a week can I work from home?"
ask "Combien coûte au maximum une nuit d'hôtel à Lyon ?"   # 110: Lyon is not one of the cities at 150
ask "What is the carbon budget of a team?"                # from the PDF
ask "How much is the yearly bonus of an engineer?"        # not in the handbook
```

Add a file to `documents/` and restart: only what changed is indexed again.

## Evaluate it

```bash
./mvnw verify -Pevals && cat target/evals-report.md
```

Each question goes to the whole agent on Ollama; the words of `mustContain` and `mustNotContain` are checked in Java,
and the model judges the criterion, yes or no. The run fails below 80%. Twice in a row here: 6/6, in about six minutes
on a laptop CPU. A plain `./mvnw verify` never calls a model.

## Limits

- Small models read literally: before the remote work page said "work from home", the question with those words got
  "the handbook does not say". Write documents with the words your users use, and add their questions to the
  reference set.
- On a laptop CPU, `qwen2.5:7b` takes 30 to 60 seconds per answer, the reranking included.
- The knowledge base is shared by all the users of the agent; uploads by an administrator need sign-in (profile
  `standard`).
