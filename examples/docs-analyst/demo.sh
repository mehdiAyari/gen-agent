#!/usr/bin/env bash
# Scripted demo of demo.gif: the agent started with its Postgres in Docker, questions answered from the handbook (a PDF
# among them), one it cannot answer, then the evaluations. Needs Java 21, Docker and Ollama (qwen2.5:7b,
# nomic-embed-text).
# Recorded with: asciinema rec --window-size 110x30 --command "bash demo.sh" demo.cast
# Converted with: agg --idle-time-limit 2 --font-size 16 --theme monokai demo.cast demo.gif
set -euo pipefail
cd "$(dirname "$0")/app"
type_cmd() { printf '\033[1;32m$\033[0m '; for ((i = 0; i < ${#1}; i++)); do printf '%s' "${1:i:1}"; sleep 0.02; done; echo; sleep 0.4; }

type_cmd "ls documents"
ls documents; sleep 2

type_cmd "./mvnw -q spring-boot:test-run &   # Postgres with pgvector starts in Docker"
./mvnw -q spring-boot:test-run > spring-boot.log 2>&1 &
until [ "$(grep -c "Indexed " spring-boot.log)" -ge 4 ]; do sleep 1; done
grep -o "Indexed .*" spring-boot.log; sleep 2

type_cmd "ask() { curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d \"{\\\"message\\\": \\\"\$1\\\"}\" | jq -r .reply; }"
ask() {
  type_cmd "ask \"$1\""
  curl -s localhost:8080/api/chat -H 'Content-Type: application/json' -d "{\"message\": \"$1\"}" | jq -r .reply; echo; sleep 3
}
ask "Combien coûte au maximum une nuit d'hôtel à Lyon ?"
ask "What is the carbon budget of a team?"
ask "How much is the yearly bonus of an engineer?"
kill %1 2> /dev/null

type_cmd "./mvnw -q verify -Pevals && cat target/evals-report.md"
./mvnw -q verify -Pevals > /dev/null 2>&1 && cat target/evals-report.md; sleep 4
