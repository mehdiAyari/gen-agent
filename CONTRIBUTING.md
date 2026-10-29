# Contributing to gen-agent

Thanks for your interest! gen-agent generates Spring AI projects that must read as if a good Spring developer wrote them
by hand: that bar applies to every change.

## Set up

Node 22+, pnpm, JDK 21 (Maven and Gradle are downloaded by the wrappers of the generated projects), Docker, Helm, and
Google Chrome for the end-to-end tests.

```bash
pnpm install    # also installs the Git hooks
pnpm build      # type-aware linting reads the types of the built packages
pnpm lint && pnpm knip && pnpm typecheck && pnpm test
pnpm coverage   # the unit tests with their coverage, per package
pnpm e2e        # builds the reference projects (./mvnw verify or ./gradlew build) and lints their Helm charts,
                # then drives the web generator and the packed CLI
```

The end-to-end tests build the reference projects and an agent made from the official Petstore spec, download
projects from the web generator (one after an OpenAPI import), check they are identical to the CLI output and build
them, drive `gen-agent mcp` from the packed npm package with an MCP client, and check the pages with
[axe](https://github.com/dequelabs/axe-core).

## How the code is organized

| Package               | Role                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| `packages/core`       | `agent.yaml` schema (Zod) and rules, normalized model, renderer         |
| `packages/templates`  | EJS templates, reference agents and their file snapshots                |
| `packages/openapi`    | OpenAPI 3 operations to HTTP tools (Node and browser)                   |
| `packages/cli`        | the `gen-agent` command, published as one bundled package               |
| `packages/mcp-server` | gen-agent as an MCP server, bundled in the CLI as `gen-agent mcp`       |
| `packages/web`        | the web generator (Next.js static export, English and French)           |
| `e2e`                 | builds of the reference projects, Playwright tests of the web generator |

Design decisions are recorded in [`docs/adr`](docs/adr).

## Rules

- **Tests first.** Every change comes with a failing test that the change makes pass.
- **Templates**: write every Java type through `type('…')` so imports are exact; no logic beyond `if`/`for` over the
  model (names and defaults are computed in `core`); a disabled option leaves no trace. Read
  [`docs/template-authoring.md`](docs/template-authoring.md).
- **Snapshots**: after changing a template, run `pnpm --filter @gen-agent/templates exec vitest run -u` and read every
  changed snapshot as a code reviewer would before committing.
- **Schema**: after changing the Zod schema, run `pnpm --filter @gen-agent/core schema` to refresh the JSON Schema.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org) (checked by a hook).
- **Secrets** never appear in `agent.yaml`, in templates, or in tests: only `${ENV_VAR}` references.
