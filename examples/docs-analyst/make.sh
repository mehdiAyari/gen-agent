#!/usr/bin/env bash
# Makes the docs-analyst project from scratch, with the commands of the README: ./make.sh [directory]
# The directory (app by default) must not exist. The documents, the reference set of the evaluations and the system
# prompt were written by hand afterwards.
set -euo pipefail
gen_agent=${GEN_AGENT:-npx gen-agent}
work=$(mktemp -d)
target=$(realpath -m "${1:-app}")

cd "$work"
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
$gen_agent generate --from agent.yaml --output "$target"
