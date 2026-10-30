#!/usr/bin/env bash
# Makes the bank-desk project from scratch, with the commands of the README: ./make.sh [directory]
# The directory (app by default) must not exist. The tool handlers, their tables, the reference set of the evaluations
# and the system prompt were written by hand afterwards.
set -euo pipefail
gen_agent=${GEN_AGENT:-npx gen-agent}
work=$(mktemp -d)
target=$(realpath -m "${1:-app}")

cd "$work"
cat > agent.yaml << 'YAML'
agent:
  name: bank-desk
  description: Helps the customers of the bank check their balance and send transfers
  profile: production
  model:
    provider: ollama
    name: qwen2.5:7b
    temperature: 0
    fallback:
      provider: ollama
      name: qwen2.5:3b
  interface: [rest, chat-ui]
  deploy: [docker-compose, helm]
YAML
$gen_agent generate --from agent.yaml --output "$target"

$gen_agent add tool account-balance --type java --dir "$target" \
  --description "Balance of the account of the signed-in customer, in euros"
$gen_agent add tool send-transfer --type java --dir "$target" --approval \
  --param "iban:string:required:the IBAN of the recipient, as the customer wrote it" \
  --param "amount:number:required:the amount, in euros" \
  --description "Sends a transfer from the account of the signed-in customer"
