# V3 — OpenAPI import and MCP server

Validated on 2026-10-23. OpenAPI import is the core of V3: no comparable tool turns an API description into a
complete, tested Spring AI agent. The MCP server comes second and stays small. No code from other generators is reused.

## Decisions

|     | Decision                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `agent.yaml` may reference a spec (`openapi: [{ spec, include }]`), resolved at each generation by the CLI. The web UI copies the tools in clear (no file system); `gen-agent import openapi --expand` does the same in the CLI. |
| B   | HTTP tool authentication from an environment variable only: `auth: { type: bearer, env }` or `auth: { type: header, name, env }`. Derived from `securitySchemes` on import.                                                      |
| C   | OpenAPI 3.0 and 3.1, local `$ref` only. JSON bodies: flat objects of scalars. Nested objects, files and business headers are skipped with a reason. Swagger 2.0 is refused with a message.                                       |
| D   | Tool name: `operationId` in kebab-case, else method and path (`get-orders-by-id`).                                                                                                                                               |
| E   | Warning above 20 tools; `include` filters operations.                                                                                                                                                                            |
| F   | Responses sent to the model are truncated (20 000 characters by default, `maxResponseChars` per tool).                                                                                                                           |
| G   | MCP server: `gen-agent mcp` (stdio), code in `packages/mcp-server`, bundled in the CLI. Writes only into an empty directory under the client's working directory.                                                                |
| H   | `import openapi <url>`: https only, the spec is saved under `specs/` so that generation is reproducible.                                                                                                                         |

## Steps

1. **Complete HTTP tools.** Parameters `in: path | query | body` (defaults: path when the URL has `{name}`, query for
   GET and DELETE, body otherwise), URL templates, `auth`, `maxResponseChars`. Rules: placeholders and path parameters
   match, path parameters are required, no body on GET or DELETE, environment variable names in upper case. Path values
   are encoded (no path traversal from the model). Generated code, tests, snapshots, web form.
2. **`packages/openapi`.** Spec → tools, with the operations it skips and why. Runs in Node and browsers.
3. **CLI.** `gen-agent import openapi <file|url> [--include …] [--expand]`; `generate` resolves `agent.openapi`.
4. **Web UI.** "Import OpenAPI": drop a spec, pick operations, they become tools.
5. **E2E.** Spec → project → `./mvnw verify`, from the CLI and from the site.
6. **MCP server.** Tools `validate_agent`, `preview_project`, `import_openapi`, `generate_project`; the JSON Schema as
   a resource. Tested with an MCP client; the generated project passes `mvnw verify`.
7. **Showcase.** README, GIF of the OpenAPI import, Claude Code generating an agent through MCP, CHANGELOG, ROADMAP.
