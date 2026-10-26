# Contributing to gen-agent

Thanks for your interest! gen-agent generates Spring AI projects that must read as if a good Spring developer wrote them
by hand: that bar applies to every change.

## Set up

Node 22+, pnpm, JDK 21 (Maven is downloaded by the generated projects' wrapper), Docker, and Helm for the end-to-end
tests, which lint the generated charts.

```bash
pnpm install
pnpm lint && pnpm knip && pnpm typecheck && pnpm test
pnpm e2e   # generates the reference projects, runs ./mvnw verify on each, and installs the packed CLI
```

## How the code is organized

| Package              | Role                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `packages/core`      | `agent.yaml` schema (Zod) and rules, normalized model, renderer      |
| `packages/templates` | EJS templates per profile, reference agents and their file snapshots |
| `packages/cli`       | the `gen-agent` command, published as one bundled package            |
| `e2e`                | Maven builds of the reference projects, packaging test               |

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
