#!/usr/bin/env bash
# Makes the hr-assistant project from scratch, with the commands of the README: ./make.sh [directory]
# The directory (app by default) must not exist. The tool handlers, their table and the system prompt were written by
# hand afterwards.
set -euo pipefail
gen_agent=${GEN_AGENT:-npx gen-agent}
work=$(mktemp -d)
target=$(realpath -m "${1:-app}")

cd "$work"
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
$gen_agent generate --from agent.yaml --output "$target"

# Two tools, added to the generated project: the handlers are written by hand.
$gen_agent add tool remaining-days-off --type java --dir "$target" \
  --description "Days off the signed-in employee has left this year"
$gen_agent add tool book-day-off --type java --dir "$target" --approval --param date:string:required \
  --description "Books a day off for the signed-in employee, on a date written YYYY-MM-DD"
