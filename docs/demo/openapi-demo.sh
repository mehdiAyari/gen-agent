#!/usr/bin/env bash
# Scripted demo of the OpenAPI GIF: an existing API (the public Petstore) → agent → conversation with a real model
# that calls the API. Needs gen-agent on the PATH, Java 21, and Ollama serving qwen2.5:3b (no API key, no cost).
# Recorded with: asciinema rec --window-size 120x34 --command "bash openapi-demo.sh" openapi-demo.cast
# Converted with: agg --idle-time-limit 2 --font-size 16 --theme monokai openapi-demo.cast openapi-demo.gif
set -euo pipefail
cd "$(mktemp -d)"
type_cmd() { printf '\033[1;32m$\033[0m '; for ((i = 0; i < ${#1}; i++)); do printf '%s' "${1:i:1}"; sleep 0.03; done; echo; sleep 0.4; }

cat > agent.yaml << 'YAML'
agent:
  name: pet-assistant
  description: Helps the customers of the pet store
  model:
    provider: ollama
    name: qwen2.5:3b
    temperature: 0
YAML

type_cmd "cat agent.yaml"
cat agent.yaml; sleep 2

type_cmd "gen-agent import openapi https://petstore3.swagger.io/api/v3/openapi.json --include findPetsByStatus,getPetById"
gen-agent import openapi https://petstore3.swagger.io/api/v3/openapi.json --include findPetsByStatus,getPetById; sleep 3

type_cmd "gen-agent generate --from agent.yaml"
gen-agent generate --from agent.yaml; sleep 2

type_cmd "cd pet-assistant && export PETSTORE_TOKEN=demo PETSTORE_API_KEY=special-key   # the demo store takes any key"
cd pet-assistant
export PETSTORE_TOKEN=demo PETSTORE_API_KEY=special-key

type_cmd "./mvnw -q spring-boot:run &"
./mvnw -q spring-boot:run > spring-boot.log 2>&1 &
until curl -s localhost:8080/api/chat > /dev/null 2>&1; do sleep 1; done
grep -o "Started PetAssistantApplication.*" spring-boot.log; sleep 1

ask() {
  local body="{\"conversationId\": \"demo\", \"message\": \"$1\"}"
  type_cmd "curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d '$body'"
  curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d "$body"; echo; sleep 3
}
ask "Which pets are available for adoption? Give me three names."
ask "What is the name of the pet with id 10?"

kill %1 2> /dev/null
