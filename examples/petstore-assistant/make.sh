#!/usr/bin/env bash
# Makes the petstore-assistant project from scratch, with the commands of the README: ./make.sh [directory]
# The directory (app by default) must not exist. Only the system prompt was written by hand afterwards.
set -euo pipefail
gen_agent=${GEN_AGENT:-npx gen-agent}
spec=https://petstore3.swagger.io/api/v3/openapi.json
work=$(mktemp -d)
target=$(realpath -m "${1:-app}")

cd "$work"
# SPECS: a directory holding a copy of the spec, for offline runs (the end-to-end tests).
if [ -n "${SPECS:-}" ]; then mkdir specs && cp "$SPECS/petstore.json" specs/ && spec=specs/petstore.json; fi
cat > agent.yaml << 'YAML'
agent:
  name: petstore-assistant
  description: Helps the customers of the pet store find a pet
  model:
    provider: ollama
    name: qwen2.5:7b
    temperature: 0
YAML

$gen_agent import openapi "$spec" --base-url https://petstore3.swagger.io/api/v3 \
  --include findPetsByStatus,getPetById
$gen_agent generate --from agent.yaml --output "$target"
