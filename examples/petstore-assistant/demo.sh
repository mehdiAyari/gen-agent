#!/usr/bin/env bash
# Scripted demo of demo.gif: the commands of the README, typed in an empty directory, then a conversation with the
# agent on Ollama (qwen2.5:7b). Needs gen-agent on the PATH and Java 21.
# Recorded with: asciinema rec --window-size 110x30 --command "bash demo.sh" demo.cast
# Converted with: agg --idle-time-limit 2 --font-size 16 --theme monokai demo.cast demo.gif
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cd "$(mktemp -d)"
cp "$here/app/src/main/resources/prompts/system.md" .
type_cmd() { printf '\033[1;32m$\033[0m '; for ((i = 0; i < ${#1}; i++)); do printf '%s' "${1:i:1}"; sleep 0.02; done; echo; sleep 0.4; }

cat > agent.yaml << 'YAML'
agent:
  name: petstore-assistant
  description: Helps the customers of the pet store find a pet
  model:
    provider: ollama
    name: qwen2.5:7b
    temperature: 0
YAML
type_cmd "cat agent.yaml"
cat agent.yaml; sleep 2

type_cmd "gen-agent import openapi https://petstore3.swagger.io/api/v3/openapi.json \\"
type_cmd "    --base-url https://petstore3.swagger.io/api/v3 --include findPetsByStatus,getPetById"
gen-agent import openapi https://petstore3.swagger.io/api/v3/openapi.json \
  --base-url https://petstore3.swagger.io/api/v3 --include findPetsByStatus,getPetById 2>&1 | grep -v '^│$' | head -8
sleep 2

type_cmd "gen-agent generate --from agent.yaml --output app"
gen-agent generate --from agent.yaml --output app > /dev/null
echo "Created petstore-assistant in app"; sleep 1

type_cmd "cp system.md app/src/main/resources/prompts/   # the only file written by hand"
cp system.md app/src/main/resources/prompts/
cd app
export PETSTORE_TOKEN=demo PETSTORE_API_KEY=special-key
type_cmd "./mvnw -q spring-boot:run &"
./mvnw -q spring-boot:run > spring-boot.log 2>&1 &
until curl -s -o /dev/null localhost:8080/api/chat; do sleep 1; done
grep -o "Started PetstoreAssistantApplication.*" spring-boot.log; sleep 1

ask() {
  local body="{\"conversationId\": \"demo\", \"message\": \"$1\"}"
  type_cmd "curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d '$body' | jq -r .reply"
  curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d "$body" | jq -r .reply; echo; sleep 3
}
ask "Which pets are available right now?"
ask "Tell me about the pet with id 10."

kill %1 2> /dev/null
