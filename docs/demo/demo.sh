#!/usr/bin/env bash
# Scripted demo of the README GIF: agent.yaml → project → running agent → conversation with a real model.
# Needs gen-agent on the PATH, Java 21, and Ollama serving qwen2.5:3b (no API key, no cost).
# Recorded with: asciinema rec --window-size 110x32 --command "bash demo.sh" demo.cast
# Converted with: agg --idle-time-limit 2 --font-size 16 --theme monokai demo.cast demo.gif
set -euo pipefail
cd "$(dirname "$0")"
type_cmd() { printf '\033[1;32m$\033[0m '; for ((i = 0; i < ${#1}; i++)); do printf '%s' "${1:i:1}"; sleep 0.03; done; echo; sleep 0.4; }

type_cmd "cat agent.yaml"
cat agent.yaml; sleep 2.5

type_cmd "gen-agent generate --from agent.yaml"
gen-agent generate --from agent.yaml; sleep 2

type_cmd "cd weather-agent && ls src/main/java/com/example/weatheragent/generated/*"
cd weather-agent; ls src/main/java/com/example/weatheragent/generated/*; sleep 2

type_cmd "./mvnw -q spring-boot:run &"
./mvnw -q spring-boot:run > spring-boot.log 2>&1 &
until curl -s localhost:8080/api/chat > /dev/null 2>&1; do sleep 1; done
grep -o "Started WeatherAgentApplication.*" spring-boot.log; sleep 1

ask() {
  local body="{\"conversationId\": \"demo\", \"message\": \"$1\"}"
  type_cmd "curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d '$body'"
  curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d "$body"; echo; sleep 3
}
ask "What is the weather right now in Paris (48.85, 2.35)?"
ask "Which city did I ask about?"

kill %1 2> /dev/null
