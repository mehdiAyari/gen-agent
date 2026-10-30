# Examples

Complete agents, each made by gen-agent from a few commands, then finished by hand. Each one shows:

- `make.sh`: the exact commands that made it, from an empty directory;
- `app/`: the project as gen-agent wrote it, plus the files written by hand afterwards (listed in its README);
- `demo.gif`: a real run, recorded on [Ollama](https://ollama.com), with no API key.

| Example                                  | Profile            | What it shows                                                                                           |
| ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| [petstore-assistant](petstore-assistant) | `minimal`          | An existing API turned into an agent from its OpenAPI spec: two commands, no Java written.              |
| [hr-assistant](hr-assistant)             | `standard`         | Business code written by hand: days off booked only after the employee approves, in the chat page.      |
| [docs-analyst](docs-analyst)             | `minimal` with RAG | Answers from Markdown and PDF documents, "the handbook does not say" otherwise, scored by evaluations.  |
| [bank-desk](bank-desk)                   | `production`       | An IBAN the model never sees, masked in the logs, a transfer approved by the customer, attacks refused. |

The end-to-end tests run every `make.sh` again on each change: the generated files must be identical, only the files
written by hand may differ, and each example must pass its build. Regenerating a project never touches your code.
